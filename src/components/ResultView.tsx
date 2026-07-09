import { computeMisplacement } from '../domain/misplacement'
import { parseCallNumber } from '../domain/parse'

interface ResultViewProps {
  items: string[]
  photoDataUrl: string
  onRestart: () => void
  onBackToEdit: () => void
}

/**
 * 5) 정렬 엔진으로 올바른 순서를 계산해 실제 배열과 비교, 오배열 도서를 판정하고
 * 6) 이동 안내(같은 프레임 안이면 순번, 범위 밖이면 "다른 구간으로 이동")를 보여준다.
 * 7) 촬영한 사진도 함께 표시한다.
 */
export function ResultView({ items, photoDataUrl, onRestart, onBackToEdit }: ResultViewProps) {
  const parsed = items.map(parseCallNumber)
  const { inPlace, moves } = computeMisplacement(parsed)
  const moveByIndex = new Map(moves.map((m) => [m.index, m]))
  const okCount = items.length - moves.length

  return (
    <div className="result-view">
      <img className="edit-thumb" src={photoDataUrl} alt="촬영한 서가 사진" />

      <div className="stat-card">
        <div className="stat-block">
          <span className="stat-value">{items.length}</span>
          <span className="stat-label">전체</span>
        </div>
        <div className="stat-divider" aria-hidden="true" />
        <div className="stat-block">
          <span className="stat-value stat-value-ok">{okCount}</span>
          <span className="stat-label">제자리</span>
        </div>
        <div className="stat-divider" aria-hidden="true" />
        <div className="stat-block">
          <span className="stat-value stat-value-bad">{moves.length}</span>
          <span className="stat-label">오배열</span>
        </div>
      </div>

      <ol className="result-rows">
        {parsed.map((p, i) => {
          const move = moveByIndex.get(i)
          const ok = inPlace[i]
          return (
            <li key={i} className={ok ? 'result-row ok' : 'result-row bad'}>
              <div className="row-main">
                <span className={ok ? 'status-dot status-dot-ok' : 'status-dot status-dot-bad'} aria-hidden="true">
                  {ok ? '✓' : '!'}
                </span>
                <span className="row-index">{i + 1}</span>
                <span className="row-text">{p.raw || '(빈 항목)'}</span>
              </div>
              {move && (
                <div className="move-note">
                  {move.withinFrame
                    ? `→ ${move.targetSlot}번 자리로 이동하세요.`
                    : '→ 다른 구간으로 이동하세요 (이 사진 범위 밖 청구기호입니다).'}
                </div>
              )}
              {p.parseFailed && <div className="row-issue-note">⚠ 파싱을 확인해 주세요.</div>}
            </li>
          )
        })}
      </ol>
      <div className="capture-actions">
        <button type="button" className="secondary-button" onClick={onBackToEdit}>
          편집으로 돌아가기
        </button>
        <button type="button" className="primary-button" onClick={onRestart}>
          새로 촬영하기
        </button>
      </div>
    </div>
  )
}
