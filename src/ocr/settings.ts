const ENABLED_STORAGE_KEY = 'shelf-sort:ocr-enabled'

/** 인식은 브라우저 내장 Tesseract.js로 동작하며 API 키/토큰이 필요 없어 기본값은 켜짐이다. */
export function isOcrEnabled(): boolean {
  const stored = localStorage.getItem(ENABLED_STORAGE_KEY)
  return stored === null ? true : stored === '1'
}

export function setOcrEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_STORAGE_KEY, enabled ? '1' : '0')
}
