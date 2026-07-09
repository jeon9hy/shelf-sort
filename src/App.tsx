import { useCallback, useState } from 'react'
import './App.css'
import { CaptureView } from './components/CaptureView'
import { EditList } from './components/EditList'
import { ResultView } from './components/ResultView'
import { Settings } from './components/Settings'
import { StepIndicator } from './components/StepIndicator'
import { RemoteOcrProvider } from './ocr/remoteOcrProvider'
import { isOcrEnabled } from './ocr/settings'

type Step = 'capture' | 'edit' | 'result'

function App() {
  const [step, setStep] = useState<Step>('capture')
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [items, setItems] = useState<string[]>([])
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  const handleCapture = useCallback((dataUrl: string) => {
    setPhotoDataUrl(dataUrl)
    setItems([])
    setOcrError(null)
    setStep('edit')

    if (!isOcrEnabled()) return

    setOcrLoading(true)
    const provider = new RemoteOcrProvider()
    provider
      .recognize(dataUrl)
      .then((result) => {
        setItems((current) => (current.length === 0 ? result.texts : current))
        if (result.texts.length === 0) {
          setOcrError('청구기호를 찾지 못했습니다.')
        }
      })
      .catch((err: unknown) => {
        setOcrError(err instanceof Error ? err.message : '인식 중 오류가 발생했습니다.')
      })
      .finally(() => setOcrLoading(false))
  }, [])

  const handleRetake = useCallback(() => {
    setPhotoDataUrl(null)
    setItems([])
    setOcrError(null)
    setStep('capture')
  }, [])

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>SHELFY</h1>
        <button
          type="button"
          className="icon-button"
          onClick={() => setShowSettings(true)}
          aria-label="설정"
        >
          ⚙
        </button>
      </header>
      <StepIndicator step={step} />
      <main className="app-main">
        {step === 'capture' && <CaptureView onCapture={handleCapture} />}
        {step === 'edit' && photoDataUrl && (
          <EditList
            items={items}
            onChange={setItems}
            photoDataUrl={photoDataUrl}
            ocrLoading={ocrLoading}
            ocrError={ocrError}
            onRetake={handleRetake}
            onConfirm={() => setStep('result')}
          />
        )}
        {step === 'result' && photoDataUrl && (
          <ResultView
            items={items}
            photoDataUrl={photoDataUrl}
            onRestart={handleRetake}
            onBackToEdit={() => setStep('edit')}
          />
        )}
      </main>
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
