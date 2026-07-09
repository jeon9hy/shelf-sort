// Vercel Serverless Function: 프론트에서는 이 엔드포인트만 호출한다. 실제 Google
// Cloud Vision 호출과 API 키는 여기(서버)에만 있고 브라우저로는 절대 나가지 않는다.
//
// 필요한 환경변수 (Vercel 프로젝트 설정 > Environment Variables):
//   GOOGLE_VISION_API_KEY - Google Cloud 프로젝트에서 발급한 Vision API 키
//
// DOCUMENT_TEXT_DETECTION의 문단(paragraph) 단위 결과를 좌표 박스 배열로 정리해
// 돌려주고, "같은 책 라벨끼리 묶어 정렬"하는 작업은 프론트(src/ocr/clusterLines.ts)
// 에서 한다 — 이 함수는 Vision 응답을 얇게 프록시/정리만 한다.

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

  const paragraphs = (result?.fullTextAnnotation?.pages ?? [])
    .flatMap((page) => page.blocks ?? [])
    .flatMap((block) => block.paragraphs ?? [])

  const boxes = paragraphs
    .map((paragraph) => {
      const text = (paragraph.words ?? [])
        .map((word) => (word.symbols ?? []).map((s) => s.text).join(''))
        .join(' ')
        .trim()
      const vertices = paragraph.boundingBox?.vertices ?? []
      const xs = vertices.map((v) => v.x ?? 0)
      const ys = vertices.map((v) => v.y ?? 0)
      if (!text || xs.length === 0) return null
      return { text, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys) }
    })
    .filter((box) => box !== null)

  res.status(200).json({ boxes })
}
