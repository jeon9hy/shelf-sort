import { useState } from 'react'
import { getStoredApiKey, isOcrEnabled, setOcrEnabled, setStoredApiKey } from '../ocr/settings'

interface SettingsProps {
  onClose: () => void
}

export function Settings({ onClose }: SettingsProps) {
  const [enabled, setEnabled] = useState(isOcrEnabled())
  const [apiKey, setApiKey] = useState(getStoredApiKey())

  function save() {
    setOcrEnabled(enabled)
    setStoredApiKey(apiKey.trim())
    onClose()
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true">
      <div className="settings-panel">
        <h2>인식(OCR) 설정</h2>
        <label className="settings-toggle">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          촬영 시 비전 모델로 자동 인식 시도
        </label>
        <label className="settings-field">
          Anthropic API 키
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
          />
        </label>
        <p className="settings-warning">
          입력한 키는 이 기기의 브라우저에만 저장되고, 인식 요청 시 브라우저에서 Anthropic API로
          직접 전송됩니다. 공용/공유 기기에서는 사용하지 마세요. 인식을 켜지 않아도 편집 단계에서
          직접 입력하면 정렬·오배열 판정 기능을 그대로 사용할 수 있습니다.
        </p>
        <div className="capture-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            취소
          </button>
          <button type="button" className="primary-button" onClick={save}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
