// 실제 서가 라벨은 "분류기호 / 도서기호 / 부가기호"가 한 줄이 아니라 세로로 여러 줄
// 쌓인 작은 스티커 형태다. OCR 결과가 낱말/줄 단위 좌표(bbox)로 오면, x축이 겹치는
// 조각들을 같은 라벨(같은 책)로 묶고 그 안에서는 위→아래, 라벨끼리는 왼→오른쪽 순서로
// 정렬해 하나의 청구기호 문자열로 복원한다. OCR 엔진이 무엇이든(Tesseract, CLOVA 등)
// 같은 형태의 Box[]만 넘기면 재사용할 수 있게 분리했다.

export interface TextBox {
  text: string
  x0: number
  x1: number
  y0: number
}

interface LabelCluster {
  x0: number
  x1: number
  boxes: TextBox[]
}

const X_OVERLAP_RATIO_THRESHOLD = 0.25

function overlapRatio(aX0: number, aX1: number, bX0: number, bX1: number): number {
  const overlap = Math.min(aX1, bX1) - Math.max(aX0, bX0)
  if (overlap <= 0) return 0
  const narrower = Math.min(aX1 - aX0, bX1 - bX0)
  return narrower <= 0 ? 0 : overlap / narrower
}

export function clusterIntoLabels(boxes: TextBox[]): string[] {
  const sorted = [...boxes].sort((a, b) => a.x0 - b.x0)
  const clusters: LabelCluster[] = []

  for (const box of sorted) {
    let best: LabelCluster | null = null
    let bestScore = 0
    for (const cluster of clusters) {
      const score = overlapRatio(box.x0, box.x1, cluster.x0, cluster.x1)
      if (score > bestScore) {
        bestScore = score
        best = cluster
      }
    }
    if (best && bestScore >= X_OVERLAP_RATIO_THRESHOLD) {
      best.boxes.push(box)
      best.x0 = Math.min(best.x0, box.x0)
      best.x1 = Math.max(best.x1, box.x1)
    } else {
      clusters.push({ x0: box.x0, x1: box.x1, boxes: [box] })
    }
  }

  clusters.sort((a, b) => a.x0 + a.x1 - (b.x0 + b.x1))

  return clusters
    .map((cluster) =>
      [...cluster.boxes]
        .sort((a, b) => a.y0 - b.y0)
        .map((b) => b.text)
        .join(' '),
    )
    .filter((text) => text.length > 0)
}
