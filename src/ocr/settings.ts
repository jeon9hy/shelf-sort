const API_KEY_STORAGE_KEY = 'shelf-sort:claude-api-key'
const ENABLED_STORAGE_KEY = 'shelf-sort:ocr-enabled'

export function getStoredApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''
}

export function setStoredApiKey(key: string): void {
  if (key) localStorage.setItem(API_KEY_STORAGE_KEY, key)
  else localStorage.removeItem(API_KEY_STORAGE_KEY)
}

export function isOcrEnabled(): boolean {
  return localStorage.getItem(ENABLED_STORAGE_KEY) === '1'
}

export function setOcrEnabled(enabled: boolean): void {
  localStorage.setItem(ENABLED_STORAGE_KEY, enabled ? '1' : '0')
}
