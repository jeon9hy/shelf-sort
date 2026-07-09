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
          인식은 브라우저 안에서 완전히 로컬로 동작합니다(Tesseract.js). 서버로 사진을 보내지
          않고, API 키나 비용도 전혀 들지 않습니다. 처음 한 번만 한국어/영어 인식 모델 파일을
          내려받고 이후엔 캐시되어 오프라인에서도 동작합니다. 다만 범용 OCR이라 작은 글씨나
          세로로 쌓인 라벨은 오인식될 수 있어, 다음 편집 단계에서 꼭 확인해 고쳐 주세요. 꺼두면
          바로 수동 입력 화면으로 넘어갑니다.
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
