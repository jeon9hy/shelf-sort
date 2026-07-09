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
function extractParagraphText(paragraph) {
  let text = ''
  for (const word of paragraph.words ?? []) {
    for (const symbol of word.symbols ?? []) {
      text += symbol.text ?? ''
      const breakType = symbol.property?.detectedBreak?.type
      if (breakType === 'SPACE' || breakType === 'SURE_SPACE') {
        text += ' '
      }
    }
  }
  return text.trim()
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

  const paragraphs = (result?.fullTextAnnotation?.pages ?? [])
    .flatMap((page) => page.blocks ?? [])
    .flatMap((block) => block.paragraphs ?? [])

  const boxes = paragraphs
    .map((paragraph) => {
      const text = extractParagraphText(paragraph)
      const vertices = paragraph.boundingBox?.vertices ?? []
      const xs = vertices.map((v) => v.x ?? 0)
      const ys = vertices.map((v) => v.y ?? 0)
      if (!text || xs.length === 0) return null
      return { text, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys) }
    })
    .filter((box) => box !== null)

  res.status(200).json({ boxes })
}
