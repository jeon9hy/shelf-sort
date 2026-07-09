import { createWorker, PSM } from 'tesseract.js'
import { OcrError, type OcrProvider, type OcrResult } from './types'

// 옵션 (C)의 무료/로컬 변형: 서버 API나 토큰 과금 없이 브라우저 안에서 통째로 도는
// 오픈소스 OCR(Tesseract.js)로 인식한다. 첫 실행 시 한국어/영어 학습 데이터(수 MB)를
// 한 번 내려받아 브라우저에 캐시하며, 이후에는 네트워크 없이도 동작한다.
//
// 실제 서가 라벨은 "분류기호 / 도서기호 / 부가기호"가 한 줄이 아니라 세로로 여러 줄
// 쌓인 작은 스티커 형태다. Tesseract의 줄(line) 단위 인식 결과는 이미 같은 줄 안에서
// 올바른 좌→우 낱말 순서와 좌표(bbox)를 갖고 있으므로, x축이 겹치는 줄들을 같은
// 라벨(같은 책)로 묶고 그 안에서는 위→아래, 라벨끼리는 왼→오른쪽 순서로 정렬해
// 하나의 청구기호 문자열로 복원한다.

interface LineBox {
  text: string
  x0: number
  x1: number
  y0: number
}

interface LabelCluster {
  x0: number
  x1: number
  lines: LineBox[]
}

const X_OVERLAP_RATIO_THRESHOLD = 0.25

function overlapRatio(aX0: number, aX1: number, bX0: number, bX1: number): number {
  const overlap = Math.min(aX1, bX1) - Math.max(aX0, bX0)
  if (overlap <= 0) return 0
  const narrower = Math.min(aX1 - aX0, bX1 - bX0)
  return narrower <= 0 ? 0 : overlap / narrower
}

function clusterIntoLabels(lines: LineBox[]): string[] {
  const sorted = [...lines].sort((a, b) => a.x0 - b.x0)
  const clusters: LabelCluster[] = []

  for (const line of sorted) {
    let best: LabelCluster | null = null
    let bestScore = 0
    for (const cluster of clusters) {
      const score = overlapRatio(line.x0, line.x1, cluster.x0, cluster.x1)
      if (score > bestScore) {
        bestScore = score
        best = cluster
      }
    }
    if (best && bestScore >= X_OVERLAP_RATIO_THRESHOLD) {
      best.lines.push(line)
      best.x0 = Math.min(best.x0, line.x0)
      best.x1 = Math.max(best.x1, line.x1)
    } else {
      clusters.push({ x0: line.x0, x1: line.x1, lines: [line] })
    }
  }

  clusters.sort((a, b) => a.x0 + a.x1 - (b.x0 + b.x1))

  return clusters
    .map((cluster) =>
      [...cluster.lines]
        .sort((a, b) => a.y0 - b.y0)
        .map((l) => l.text)
        .join(' '),
    )
    .filter((text) => text.length > 0)
}

export class TesseractOcrProvider implements OcrProvider {
  async recognize(imageDataUrl: string): Promise<OcrResult> {
    let worker
    try {
      worker = await createWorker('kor+eng')
    } catch (err) {
      throw new OcrError(
        err instanceof Error
          ? `OCR 엔진을 불러오지 못했습니다(인터넷 연결을 확인해 주세요): ${err.message}`
          : 'OCR 엔진을 불러오지 못했습니다.',
      )
    }

    try {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
      const { data } = await worker.recognize(imageDataUrl, {}, { blocks: true })

      const lines: LineBox[] = []
      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            const text = line.text.replace(/\s+/g, ' ').trim()
            if (text) {
              lines.push({ text, x0: line.bbox.x0, x1: line.bbox.x1, y0: line.bbox.y0 })
            }
          }
        }
      }

      return { texts: clusterIntoLabels(lines) }
    } catch (err) {
      throw new OcrError(err instanceof Error ? err.message : '인식 중 오류가 발생했습니다.')
    } finally {
      await worker.terminate()
    }
  }
}
