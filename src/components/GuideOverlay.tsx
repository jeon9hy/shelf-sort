/**
 * 촬영 시 청구기호 라벨 줄을 맞추도록 돕는 가이드 프레임 오버레이.
 * 수평 안내선(점선)에 책등 라벨을 맞추면 인식률과 좌→우 순서 판독이 안정적이다.
 */
export function GuideOverlay() {
  return (
    <div className="guide-overlay" aria-hidden="true">
      <div className="guide-frame">
        <span className="guide-corner corner-tl" />
        <span className="guide-corner corner-tr" />
        <span className="guide-corner corner-bl" />
        <span className="guide-corner corner-br" />
        <span className="guide-line" style={{ top: '30%' }} />
        <span className="guide-line guide-line-main" style={{ top: '50%' }} />
        <span className="guide-line" style={{ top: '70%' }} />
      </div>
    </div>
  )
}
