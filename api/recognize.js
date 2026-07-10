import { Redis } from '@upstash/redis'

// Vercel Serverless Function: 프론트에서는 이 엔드포인트만 호출한다. 실제 Gemini
// 호출과 API 키는 여기(서버)에만 있고 브라우저로는 절대 나가지 않는다.
//
// 필요한 환경변수 (Vercel 프로젝트 설정 > Environment Variables):
//   GEMINI_API_KEY  - Google AI Studio(https://aistudio.google.com/apikey)에서
//                      발급한 Gemini API 키. Cloud Vision과 달리 결제 계정 연결
//                      없이 무료 등급 키를 바로 받을 수 있다.
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//     - Vercel Marketplace의 Upstash Redis 연동을 프로젝트에 추가하면 자동 주입됨.
//       (Storage 탭 > Redis 검색 > 이 프로젝트에 Connect)
//       이 두 값이 없으면 사용량 집계 없이(한도 체크 없이) 그냥 동작한다.
//
// 순수 OCR(Cloud Vision)은 사진에 보이는 글자를 전부 그대로 뱉어낼 뿐이라, "이게
// 청구기호인지 책 제목인지", "이 줄과 저 줄이 같은 라벨인지", "이 동그라미가 'ㅇ'인지
// '0'인지"를 전부 규칙(정규식)으로 하나씩 보정해야 했다. Gemini 같은 비전 모델은
// 이미지를 이해하고 프롬프트 지시를 따르므로, 그 판단을 모델에게 맡기고 우리는 바로
// 정렬된 청구기호 문자열 배열을 받는다.

const MODEL = 'gemini-2.5-flash'

// Gemini Flash 무료 등급은 보통 "일(day)" 단위로 리셋된다(Vision의 월 단위와 다름).
// 정확한 현재 무료 한도는 시점에 따라 바뀔 수 있어(ai.google.dev/gemini-api/docs/rate-limits
// 에서 확인), 실제 무료 한도보다 넉넉히 낮은 값으로 안전 마진을 크게 잡는다 — 이
// 앱은 개인/도서관 내부용이라 하루 200건이면 실사용에 지장이 없다.
const FREE_QUOTA_LIMIT = 200
const USAGE_KEY_TTL_SECONDS = 3 * 24 * 3600 // 다음 날 키가 새로 시작되므로 여유 있게 정리

function currentDayUsageKey() {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  const d = String(now.getUTCDate()).padStart(2, '0')
  return `gemini-ocr-usage:${y}-${m}-${d}`
}

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  try {
    return Redis.fromEnv()
  } catch {
    return null
  }
}

const PROMPT = `이 사진은 도서관 서가 책등에 붙은 청구기호 라벨입니다. 형식은 [별치기호] 분류기호 도서기호 [부가기호]이고,
예시: "004.73 박25ㅇ", "아 843.5 23ㅇ v.2", "004.73 박883ㅇ v.2026", "004.73 반44초 c.2".

- 분류기호: 소수점이 있을 수 있는 숫자 (예: 004.73, 843.5)
- 도서기호: 한글(저자기호) + 숫자 + 한글(저작기호, 없을 수도 있음)을 공백 없이 붙여 쓴 형태 (예: 박25ㅇ, 반44초).
  저작기호 자리에 오는 동그란 자모 'ㅇ'을 숫자 '0'으로 착각하지 마세요 — 도서기호 끝자리는 거의 항상 한글 자모입니다.
- 부가기호: v.2, c.2, v.2026 같은 형태
- 별치기호: 분류기호 앞에 오는 짧은 한글 (예: "아")

라벨은 보통 책등 아래쪽의 작은 스티커에 여러 줄로 나뉘어 인쇄되어 있습니다(분류기호 한 줄, 도서기호 한 줄, 있으면
부가기호가 또 한 줄). 같은 라벨에 속한 여러 줄을 공백으로 이어붙여 하나의 청구기호 문자열로 합쳐 주세요.

사진에는 책 제목, 저자명, 출판사 로고, 바코드 숫자 스티커 등 청구기호가 아닌 글자도 많이 보입니다. 그런 것은
절대 포함하지 말고, 오직 청구기호 라벨만 읽으세요. 글자가 흐릿해도 보이는 대로 최대한 옮겨 적으세요.

각 책의 청구기호를 사진 속 왼쪽에서 오른쪽 순서 그대로 items 배열에 담아 반환하세요.`

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description: '사진 속 책등에 적힌 청구기호를 왼쪽에서 오른쪽 순서대로 나열',
    },
  },
  required: ['items'],
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error: '서버에 Gemini가 설정되지 않았습니다 (GEMINI_API_KEY 환경변수 필요).',
    })
    return
  }

  const body = req.body ?? {}
  const image = typeof body.image === 'string' ? body.image : null
  const mimeType = typeof body.mimeType === 'string' && body.mimeType ? body.mimeType : 'image/jpeg'
  if (!image) {
    res.status(400).json({ error: 'image(base64) 값이 필요합니다.' })
    return
  }

  const redis = getRedis()
  const usageKey = currentDayUsageKey()

  if (redis) {
    let usedCount = 0
    try {
      usedCount = Number((await redis.get(usageKey)) ?? 0)
    } catch {
      usedCount = 0
    }
    if (usedCount >= FREE_QUOTA_LIMIT) {
      res.status(429).json({
        error: `오늘 무료 인식 사용량(${FREE_QUOTA_LIMIT}회)을 다 썼습니다. 내일 다시 자동 인식을 쓸 수 있고, 지금은 청구기호를 직접 입력해 주세요.`,
        quotaExceeded: true,
      })
      return
    }
  }

  const payload = {
    contents: [
      {
        parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: image } }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  }

  let geminiResponse
  try {
    geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    )
  } catch {
    res.status(502).json({ error: 'Gemini 서버 호출에 실패했습니다.' })
    return
  }

  if (!geminiResponse.ok) {
    const text = await geminiResponse.text().catch(() => '')
    // 원본 오류는 서버 로그에만 남기고(개발자 디버깅용), 사용자에게는 상황에 맞는
    // 안내만 짧게 보여준다 — Gemini의 원문 JSON 에러 메시지를 그대로 노출하지 않는다.
    console.error(`Gemini API error (${geminiResponse.status}):`, text.slice(0, 1000))

    if (geminiResponse.status === 429) {
      res.status(429).json({
        error: 'Gemini 사용량 한도에 도달했습니다. 잠시 후 다시 시도하거나 청구기호를 직접 입력해 주세요.',
        quotaExceeded: true,
      })
      return
    }

    res.status(502).json({
      error: `인식 서버에 일시적인 문제가 발생했습니다 (${geminiResponse.status}). 잠시 후 다시 시도하거나 직접 입력해 주세요.`,
    })
    return
  }

  const data = await geminiResponse.json()
  const candidate = data.candidates?.[0]

  if (!candidate || (candidate.finishReason && candidate.finishReason !== 'STOP')) {
    res.status(502).json({
      error: `Gemini가 결과를 반환하지 못했습니다 (${candidate?.finishReason ?? '알 수 없는 이유'}).`,
    })
    return
  }

  const textPart = candidate.content?.parts?.find((p) => typeof p.text === 'string')
  if (!textPart) {
    res.status(502).json({ error: 'Gemini 응답에서 텍스트를 찾지 못했습니다.' })
    return
  }

  let parsed
  try {
    parsed = JSON.parse(textPart.text)
  } catch {
    res.status(502).json({ error: 'Gemini 응답을 해석하지 못했습니다.' })
    return
  }

  const items = Array.isArray(parsed?.items) ? parsed.items.filter((t) => typeof t === 'string') : []

  // Gemini 호출이 실제로 성공했을 때만 사용량을 센다(과금 단위와 일치시키기 위해).
  if (redis) {
    try {
      const newCount = await redis.incr(usageKey)
      if (newCount === 1) await redis.expire(usageKey, USAGE_KEY_TTL_SECONDS)
    } catch {
      // 카운팅 실패는 요청 자체를 실패시키지 않는다.
    }
  }

  res.status(200).json({ items })
}
