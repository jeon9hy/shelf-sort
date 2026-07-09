/** OCR/비전 인식 결과. texts는 사진 속 왼쪽→오른쪽 순서로 인식된 청구기호 원문 배열. */
export interface OcrResult {
  texts: string[]
}

export interface OcrProvider {
  /** dataUrl(예: "data:image/jpeg;base64,...")을 받아 왼쪽→오른쪽 순서의 청구기호 배열을 반환한다. */
  recognize(imageDataUrl: string): Promise<OcrResult>
}

export class OcrError extends Error {}
