import { parseCallNumber } from '../domain/parse'

interface EditListProps {
  items: string[]
  onChange: (items: string[]) => void
  photoDataUrl: string
  ocrLoading: boolean
  ocrError: string | null
  onRetake: () => void
  onConfirm: () => void
}

/**
 * 3) 인식(또는 수동 추가)된 청구기호 리스트를 4) 사용자가 직접 수정하는 편집 단계.
 * OCR 인식 정확도와 무관하게, 이 화면만으로 청구기호를 전부 수동 입력해도 정렬
 * 엔진이 완전히 동작한다.
 */
export function EditList({
  items,
  onChange,
  photoDataUrl,
  ocrLoading,
  ocrError,
  onRetake,
  onConfirm,
}: EditListProps) {
  function updateAt(index: number, text: string) {
    const next = [...items]
    next[index] = text
    onChange(next)
  }

  function removeAt(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }

  function addRow() {
    onChange([...items, ''])
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= items.length) return
    const next = [...items]
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    onChange(next)
  }

  const parsedRows = items.map((text) => parseCallNumber(text))
  const hasIssues = parsedRows.some((p) => p.parseFailed)
  const hasEmpty = items.some((t) => t.trim().length === 0)

  return (
    <div className="edit-view">
      <img className="edit-thumb" src={photoDataUrl} alt="촬영한 서가 사진" />
      {ocrLoading && <p className="status-line">인식 중입니다...</p>}
      {ocrError && (
        <p className="status-line status-error">{ocrError} 아래에서 직접 입력하거나 수정해 주세요.</p>
      )}
      <p className="edit-hint">사진 속 왼쪽→오른쪽 순서대로 청구기호를 확인하고, 잘못 인식된 부분을 고쳐 주세요.</p>

      {items.length === 0 ? (
        <p className="empty-hint">아직 항목이 없습니다. "+ 항목 추가"로 청구기호를 입력해 보세요.</p>
      ) : (
        <ol className="edit-rows">
          {items.map((text, i) => {
            const parsed = parsedRows[i]
            return (
              <li key={i} className={parsed.parseFailed ? 'edit-row issue' : 'edit-row'}>
                <div className="row-main">
                  <span className="row-index">{i + 1}</span>
                  <input
                    className="row-input"
                    value={text}
                    onChange={(e) => updateAt(i, e.target.value)}
                    placeholder="예: 004.73 박25ㅇ"
                    inputMode="text"
                  />
                  <div className="row-controls">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="위로 이동">
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1}
                      aria-label="아래로 이동"
                    >
                      ▼
                    </button>
                    <button type="button" onClick={() => removeAt(i)} aria-label="삭제">
                      ✕
                    </button>
                  </div>
                </div>
                {parsed.parseFailed && text.trim() && (
                  <div className="row-issue-note">
                    {!parsed.classification && '분류기호를 찾지 못했어요. '}
                    {!parsed.bookNumber && '도서기호를 찾지 못했어요. '}
                    {parsed.bookNumber?.parseFailed && '도서기호 형식을 확인해 주세요. '}
                    {parsed.unparsedTokens.length > 0 && `확인 필요: ${parsed.unparsedTokens.join(', ')}`}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <button type="button" className="secondary-button add-row-button" onClick={addRow}>
        + 항목 추가
      </button>

      <div className="capture-actions">
        <button type="button" className="secondary-button" onClick={onRetake}>
          다시 촬영
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={onConfirm}
          disabled={items.length === 0 || hasEmpty}
        >
          정렬 확인{hasIssues ? ' (확인 필요 항목 있음)' : ''}
        </button>
      </div>
    </div>
  )
}
