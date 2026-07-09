import { useState } from 'react'
import { isOcrEnabled, setOcrEnabled } from '../ocr/settings'

interface SettingsProps {
  onClose: () => void
}

export function Settings({ onClose }: SettingsProps) {
  const [enabled, setEnabled] = useState(isOcrEnabled())

  function save() {
    setOcrEnabled(enabled)
    onClose()
  }

  return (
    <div className="settings-overlay" role="dialog" aria-modal="true">
      <div className="settings-panel">
        <h2>인식(OCR) 설정</h2>
        <label className="settings-toggle">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          촬영 시 자동으로 청구기호 인식 시도
        </label>
        <p className="settings-warning">
          인식은 이 앱의 서버(CLOVA OCR 연동)에서 처리되며, 별도 키 입력 없이 바로 사용할 수
          있습니다. 다만 작은 글씨나 세로로 쌓인 라벨은 오인식될 수 있어, 다음 편집 단계에서 꼭
          확인해 고쳐 주세요. 꺼두면 바로 수동 입력 화면으로 넘어갑니다.
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
