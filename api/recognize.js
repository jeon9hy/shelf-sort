import { Redis } from '@upstash/redis'

// Vercel Serverless Function: 프론트에서는 이 엔드포인트만 호출한다. 실제 Google
// Cloud Vision 호출과 API 키는 여기(서버)에만 있고 브라우저로는 절대 나가지 않는다.
//
// 필요한 환경변수 (Vercel 프로젝트 설정 > Environment Variables):
//   GOOGLE_VISION_API_KEY  - Google Cloud 프로젝트에서 발급한 Vision API 키
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//     - Vercel Marketplace의 Upstash Redis 연동을 프로젝트에 추가하면 자동 주입됨.
//       (Storage 탭 > Redis 검색 > 이 프로젝트에 Connect)
//       이 두 값이 없으면 사용량 집계 없이(한도 체크 없이) 그냥 동작한다 — 무료
//       한도를 넘겨서 과금될 수 있으니, 실제 서비스에선 꼭 연결해 둘 것.
//
// Google Vision 무료 한도(월 1,000건)를 안전 마진을 두고 950건에서 끊는다:
// 그 달의 요청 수를 세다가 950건을 넘으면 Vision을 아예 호출하지 않고 바로
// "이번 달 무료 사용량 소진, 수동 입력" 에러를 돌려준다.

const FREE_QUOTA_LIMIT = 950
const USAGE_KEY_TTL_SECONDS = 35 * 24 * 3600 // 다음 달 키가 새로 시작되므로 여유 있게 정리

function currentMonthUsageKey() {
  const now = new Date()
  return `vision-ocr-usage:${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  try {
    return Redis.fromEnv()
  } catch {
    return null
  }
}

// Vision은 한 문단(paragraph) 안의 낱말들을 단순히 공백으로 이어붙이면 "박25ㅁ" 같은
// 한 덩어리 청구기호 토큰이 한글/숫자/자모 경계마다 공백이 끼어 "박 25 ㅁ"로 깨진다.
// 각 symbol이 들고 있는 실제 detectedBreak 정보(진짜 띄어쓰기였는지)를 확인해서,
// Vision이 스스로 "여기 공백이 있었다"고 판단한 자리에만 공백을 넣는다.
// 공백 취급해야 하는 detectedBreak 종류. HYPHEN(줄바꿈 시 하이픈으로 이어붙임)만
// 제외 — 그 외(SPACE/SURE_SPACE/줄 경계 EOL_SURE_SPACE/LINE_BREAK)는 전부 실제
// 분리로 취급한다. Vision이 라벨의 두 줄(분류기호/도서기호)을 하나의 문단으로 묶어
// 버릴 때가 있는데, 그 경계는 SPACE가 아니라 LINE_BREAK 계열로 표시되기 때문이다.
const SPACE_WORTHY_BREAK_TYPES = new Set(['SPACE', 'SURE_SPACE', 'EOL_SURE_SPACE', 'LINE_BREAK'])

function extractParagraphText(paragraph) {
  let text = ''
  for (const word of paragraph.words ?? []) {
    for (const symbol of word.symbols ?? []) {
      text += symbol.text ?? ''
      const breakType = symbol.property?.detectedBreak?.type
      if (SPACE_WORTHY_BREAK_TYPES.has(breakType)) {
        text += ' '
      }
    }
  }
  return text.trim()
}

// 도서기호 저작기호로 흔히 쓰이는 동그란 자모 'ㅇ'과 숫자 '0'은 모양이 거의 똑같아서
// Vision이 자주 혼동한다. "앞한글+숫자...+0"으로 끝나고 그 뒤에 한글이 하나도 없는
// 도서기호 모양 토큰은, 마지막 '0'이 사실 'ㅇ'이었을 가능성이 아주 높다(반대로 진짜
// 숫자 0으로 끝나는 도서기호는 드물다). 그 경우에만 'ㅇ'으로 보정한다.
const TRAILING_ZERO_AS_IEUNG_RE = /^([가-힣ㄱ-ㅎ]+\d+)0$/
const BOOK_NUMBER_NO_WORKLETTER_RE = /^[가-힣ㄱ-ㅎ]+\d+$/

function fixCommonOcrConfusions(text) {
  const words = text.split(/\s+/).filter(Boolean)

  // Vision이 도서기호와 그 뒤의 'ㅇ'(→'0'으로 오인식) 사이에 진짜 공백까지 넣어서
  // "박883 0"처럼 두 낱말로 떼어놓는 경우도 있다. 마지막 낱말이 외톨이 "0"이고
  // 바로 앞 낱말이 저작기호 없는 도서기호 모양이면 하나로 합쳐 'ㅇ'을 붙인다.
  if (words.length >= 2 && words[words.length - 1] === '0') {
    const prev = words[words.length - 2]
    if (BOOK_NUMBER_NO_WORKLETTER_RE.test(prev)) {
      words.splice(words.length - 2, 2, `${prev}ㅇ`)
    }
  }

  // 한 낱말 안에서 바로 끝에 붙어 있는 경우("박2830")도 보정한다.
  return words.map((w) => w.replace(TRAILING_ZERO_AS_IEUNG_RE, '$1ㅇ')).join(' ')
}

// Vision은 사진에 보이는 모든 글자(책 제목, 저자명, 출판사 로고, 청구기호 라벨, 바코드
// 숫자 스티커까지)를 다 읽어온다. 우리가 원하는 건 청구기호 라벨뿐이므로, 청구기호
// 구성요소(parse.ts의 파싱 규칙과 동일한 모양)처럼 생긴 텍스트만 남기고 나머지는
// 버린다 — 책 제목/저자명은 이 좁은 정규식들과 우연히 겹치지 않는다.
const CLASSIFICATION_TOKEN_RE = /^\d{3}(?:\.\d+)?$/ // 분류기호는 항상 3자리(예: 004, 843.5)
const BOOK_NUMBER_TOKEN_RE = /^[가-힣ㄱ-ㅎ]+\d+[가-힣ㄱ-ㅎ]*$/
const SUPPLEMENT_VC_TOKEN_RE = /^[vc]\.\d+$/i
const SUPPLEMENT_YEAR_TOKEN_RE = /^\d{4}$/
const PREFIX_TOKEN_RE = /^[가-힣]{1,4}$/

function looksLikeCallNumberToken(token, y0, imageHeight) {
  if (CLASSIFICATION_TOKEN_RE.test(token)) return true
  if (BOOK_NUMBER_TOKEN_RE.test(token)) return true
  if (SUPPLEMENT_VC_TOKEN_RE.test(token)) return true
  if (SUPPLEMENT_YEAR_TOKEN_RE.test(token)) return true
  if (PREFIX_TOKEN_RE.test(token)) {
    // 짧은 한글 조각(별치기호 모양)은 책 제목의 일부일 수도 있으니, 라벨이 보통
    // 붙는 서가 사진 아래쪽 절반에 있을 때만 인정한다(모양만으로는 구분 불가).
    return imageHeight == null || y0 >= imageHeight * 0.5
  }
  return false
}

function isCallNumberLikeBox(text, y0, imageHeight) {
  const words = text.split(/\s+/).filter(Boolean)
  return words.length > 0 && words.every((w) => looksLikeCallNumberToken(w, y0, imageHeight))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' })
    return
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error: '서버에 Google Vision이 설정되지 않았습니다 (GOOGLE_VISION_API_KEY 환경변수 필요).',
    })
    return
  }

  const body = req.body ?? {}
  const image = typeof body.image === 'string' ? body.image : null
  if (!image) {
    res.status(400).json({ error: 'image(base64) 값이 필요합니다.' })
    return
  }

  const redis = getRedis()
  const usageKey = currentMonthUsageKey()

  if (redis) {
    let usedCount = 0
    try {
      usedCount = Number((await redis.get(usageKey)) ?? 0)
    } catch {
      usedCount = 0
    }
    if (usedCount >= FREE_QUOTA_LIMIT) {
      res.status(429).json({
        error: `이번 달 무료 인식 사용량(${FREE_QUOTA_LIMIT}회)을 다 썼습니다. 다음 달까지 자동 인식을 쉬고, 청구기호를 직접 입력해 주세요.`,
        quotaExceeded: true,
      })
      return
    }
  }

  const payload = {
    requests: [
      {
        image: { content: image },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        imageContext: { languageHints: ['ko'] },
      },
    ],
  }

  let visionResponse
  try {
    visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
  } catch {
    res.status(502).json({ error: 'Google Vision 서버 호출에 실패했습니다.' })
    return
  }

  if (!visionResponse.ok) {
    const text = await visionResponse.text().catch(() => '')
    res.status(502).json({ error: `Google Vision 오류 (${visionResponse.status}): ${text.slice(0, 300)}` })
    return
  }

  const data = await visionResponse.json()
  const result = data.responses?.[0]

  if (result?.error) {
    res.status(502).json({ error: `Google Vision 오류: ${result.error.message ?? '알 수 없는 오류'}` })
    return
  }

  // Vision 호출이 실제로 성공했을 때만 사용량을 센다(과금 단위와 일치시키기 위해).
  if (redis) {
    try {
      const newCount = await redis.incr(usageKey)
      if (newCount === 1) await redis.expire(usageKey, USAGE_KEY_TTL_SECONDS)
    } catch {
      // 카운팅 실패는 요청 자체를 실패시키지 않는다.
    }
  }

  const pages = result?.fullTextAnnotation?.pages ?? []
  const imageHeight = pages[0]?.height ?? null
  const paragraphs = pages.flatMap((page) => page.blocks ?? []).flatMap((block) => block.paragraphs ?? [])

  if (body.debug === true) {
    res.status(200).json({
      debugParagraphs: paragraphs.map((p) => ({
        rawText: extractParagraphText(p),
        fixedText: fixCommonOcrConfusions(extractParagraphText(p)),
        keptByFilter: isCallNumberLikeBox(fixCommonOcrConfusions(extractParagraphText(p)), Math.min(...(p.boundingBox?.vertices ?? []).map((v) => v.y ?? 0)), imageHeight),
      })),
    })
    return
  }

  const boxes = paragraphs
    .map((paragraph) => {
      const text = fixCommonOcrConfusions(extractParagraphText(paragraph))
      const vertices = paragraph.boundingBox?.vertices ?? []
      const xs = vertices.map((v) => v.x ?? 0)
      const ys = vertices.map((v) => v.y ?? 0)
      if (!text || xs.length === 0) return null
      return { text, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys) }
    })
    .filter((box) => box !== null)
    .filter((box) => isCallNumberLikeBox(box.text, box.y0, imageHeight))

  res.status(200).json({ boxes })
}
