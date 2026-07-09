import { randomUUID } from 'node:crypto'

// Vercel Serverless Function: 프론트에서는 이 엔드포인트만 호출한다. 실제 네이버
// CLOVA OCR 호출과 시크릿 키는 여기(서버)에만 있고 브라우저로는 절대 나가지 않는다.
//
// 필요한 환경변수 (Vercel 프로젝트 설정 > Environment Variables):
//   CLOVA_OCR_INVOKE_URL  - CLOVA OCR 도메인의 APIGW Invoke URL
//   CLOVA_OCR_SECRET_KEY  - 그 도메인의 Secret Key
//
// CLOVA OCR General API가 돌려주는 fields[]를 좌표 박스 배열로 정리해 돌려주고,
// 그 뒤 "같은 책 라벨끼리 묶어 정렬"하는 작업은 프론트(src/ocr/clusterLines.ts)에서
// 한다 — 이 함수는 CLOVA 응답을 얇게 프록시/정리만 한다.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 요청만 지원합니다.' })
    return
  }

  const invokeUrl = process.env.CLOVA_OCR_INVOKE_URL
  const secretKey = process.env.CLOVA_OCR_SECRET_KEY
  if (!invokeUrl || !secretKey) {
    res.status(500).json({
      error:
        '서버에 CLOVA OCR이 설정되지 않았습니다 (CLOVA_OCR_INVOKE_URL / CLOVA_OCR_SECRET_KEY 환경변수 필요).',
    })
    return
  }

  const body = req.body ?? {}
  const image = typeof body.image === 'string' ? body.image : null
  const format = typeof body.format === 'string' && body.format ? body.format : 'jpg'
  if (!image) {
    res.status(400).json({ error: 'image(base64) 값이 필요합니다.' })
    return
  }

  const payload = {
    version: 'V2',
    requestId: randomUUID(),
    timestamp: Date.now(),
    lang: 'ko',
    images: [{ format, name: 'shelf', data: image }],
  }

  let clovaResponse
  try {
    clovaResponse = await fetch(invokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-OCR-SECRET': secretKey },
      body: JSON.stringify(payload),
    })
  } catch {
    res.status(502).json({ error: 'CLOVA OCR 서버 호출에 실패했습니다.' })
    return
  }

  if (!clovaResponse.ok) {
    const text = await clovaResponse.text().catch(() => '')
    res.status(502).json({ error: `CLOVA OCR 오류 (${clovaResponse.status}): ${text.slice(0, 300)}` })
    return
  }

  const data = await clovaResponse.json()
  const fields = data.images?.[0]?.fields ?? []

  const boxes = fields
    .filter((field) => typeof field.inferText === 'string' && field.inferText.trim())
    .map((field) => {
      const vertices = field.boundingPoly?.vertices ?? []
      const xs = vertices.map((v) => v.x)
      const ys = vertices.map((v) => v.y)
      return {
        text: field.inferText.trim(),
        x0: Math.min(...xs),
        x1: Math.max(...xs),
        y0: Math.min(...ys),
      }
    })

  res.status(200).json({ boxes })
}
