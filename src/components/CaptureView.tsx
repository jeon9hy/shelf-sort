import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { GuideOverlay } from './GuideOverlay'

interface CaptureViewProps {
  onCapture: (dataUrl: string) => void
}

/**
 * 1) 카메라로 서가 사진 촬영(getUserMedia) + 2) 가이드 프레임 오버레이.
 * getUserMedia를 쓸 수 없는 환경(권한 거부, 미지원 브라우저)을 위해
 * <input type="file" accept="image/*">로 갤러리 첨부 fallback도 항상 제공한다
 * (capture 속성을 넣지 않아야 모바일에서 카메라가 아닌 사진 보관함이 열린다).
 * 촬영/갤러리 버튼은 카메라 화면 위에 떠 있는 실제 카메라 앱 느낌의 오버레이로 배치한다.
 */
export function CaptureView({ onCapture }: CaptureViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('이 브라우저는 카메라 촬영을 지원하지 않습니다.')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setCameraReady(true)
      } catch {
        setCameraError('카메라를 사용할 수 없습니다. 아래에서 사진을 촬영하거나 첨부해 주세요.')
      }
    }

    startCamera()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const capture = useCallback(() => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    onCapture(canvas.toDataURL('image/jpeg', 0.92))
  }, [onCapture])

  const onFilePicked = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') onCapture(reader.result)
      }
      reader.readAsDataURL(file)
      event.target.value = ''
    },
    [onCapture],
  )

  return (
    <div className="capture-view">
      <div className="camera-frame">
        {!cameraError ? (
          <video ref={videoRef} className="camera-video" playsInline muted />
        ) : (
          <div className="camera-fallback">{cameraError}</div>
        )}
        <GuideOverlay />
        <div className="camera-controls">
          <label className="gallery-button file-label" aria-label="갤러리에서 선택">
            <span className="gallery-button-icon" aria-hidden="true">
              🖼️
            </span>
            <input type="file" accept="image/*" onChange={onFilePicked} hidden />
          </label>
          <button
            type="button"
            className="shutter-button"
            onClick={capture}
            disabled={!cameraReady}
            aria-label="촬영"
          >
            <span className="shutter-button-ring" />
          </button>
          <div className="camera-controls-spacer" aria-hidden="true" />
        </div>
      </div>
      <p className="capture-hint">청구기호 라벨 줄이 가운데 가이드 선에 맞도록 서가를 정면에서 촬영하세요.</p>
    </div>
  )
}
