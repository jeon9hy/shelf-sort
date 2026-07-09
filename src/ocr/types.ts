/** OCR/비전 인식 결과. texts는 사진 속 왼쪽→오른쪽 순서로 인식된 청구기호 원문 배열. */
export interface OcrResult {
  texts: string[]
}

export interface OcrProvider {
  /** dataUrl(예: "data:image/jpeg;base64,...")을 받아 왼쪽→오른쪽 순서의 청구기호 배열을 반환한다. */
  recognize(imageDataUrl: string): Promise<OcrResult>
}

export class OcrError extends Error {
  /** 서버가 이번 달 무료 인식 사용량 한도를 넘겨 요청을 거부했을 때 true. */
  quotaExceeded: boolean

  constructor(message: string, quotaExceeded = false) {
    super(message)
    this.quotaExceeded = quotaExceeded
  }
}
