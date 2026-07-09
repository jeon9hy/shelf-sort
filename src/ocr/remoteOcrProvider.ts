import { clusterIntoLabels, type TextBox } from './clusterLines'
import { OcrError, type OcrProvider, type OcrResult } from './types'

// 옵션 (A) 변형: Google Cloud Vision OCR. API 키를 브라우저에 노출하지 않기 위해
// 이 프론트는 이미지를 우리 서버(Vercel Serverless Function, /api/recognize)로만
// 보내고, 그 함수가 GOOGLE_VISION_API_KEY 환경변수로 실제 Vision API를 대신
// 호출한다. 프론트는 어떤 OCR 엔진을 쓰는지 모른다 — 그냥 자체 API를 부른다.

const MAX_DIMENSION = 2000
const JPEG_QUALITY = 0.85

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new OcrError('이미지를 불러오지 못했습니다.'))
    img.src = dataUrl
  })
}

/** 업로드 페이로드 크기를 줄이고 인식 속도를 높이기 위해 긴 변 기준으로 축소한다. */
async function resizeDataUrl(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new OcrError('이미지 처리에 실패했습니다.')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

function splitDataUrl(dataUrl: string): { format: string; base64: string } {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.*)$/s)
  if (!match) throw new OcrError('이미지 데이터 형식을 읽을 수 없습니다.')
  const format = match[1] === 'jpeg' ? 'jpg' : match[1]
  return { format, base64: match[2] }
}

interface RecognizeApiResponse {
  boxes: TextBox[]
}

interface RecognizeApiError {
  error: string
}

export class RemoteOcrProvider implements OcrProvider {
  async recognize(imageDataUrl: string): Promise<OcrResult> {
    const resized = await resizeDataUrl(imageDataUrl)
    const { format, base64 } = splitDataUrl(resized)

    let response: Response
    try {
      response = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64, format }),
      })
    } catch {
      throw new OcrError('인식 서버에 연결할 수 없습니다.')
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as RecognizeApiError | null
      throw new OcrError(body?.error ?? `인식 요청이 실패했습니다 (${response.status}).`)
    }

    const data = (await response.json()) as RecognizeApiResponse
    return { texts: clusterIntoLabels(data.boxes) }
  }
}
