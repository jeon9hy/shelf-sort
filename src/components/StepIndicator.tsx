type Step = 'capture' | 'edit' | 'result'

interface StepIndicatorProps {
  step: Step
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'capture', label: '촬영' },
  { key: 'edit', label: '편집' },
  { key: 'result', label: '결과' },
]

/** 촬영→편집→결과 진행 단계를 알약 모양 스텝퍼로 보여준다. */
export function StepIndicator({ step }: StepIndicatorProps) {
  const activeIndex = STEPS.findIndex((s) => s.key === step)

  return (
    <div className="step-indicator" role="list" aria-label="진행 단계">
      {STEPS.map((s, i) => {
        const state = i === activeIndex ? 'active' : i < activeIndex ? 'done' : 'upcoming'
        return (
          <div key={s.key} role="listitem" className={`step-dot step-dot-${state}`}>
            {state === 'active' ? s.label : <span className="step-dot-num">{i + 1}</span>}
          </div>
        )
      })}
    </div>
  )
}
