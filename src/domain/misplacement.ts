import { compareCallNumbers } from './compare'
import type { ParsedCallNumber } from './types'

export interface MoveInstruction {
  /** 원래(사진 속) 인덱스, 0-based */
  index: number
  /** 이 책이 있어야 할 올바른 순번, 1-based */
  targetSlot: number
  /** 올바른 자리가 이 프레임(사진) 범위 안이면 true, 범위 밖(다른 구간)이면 false */
  withinFrame: boolean
}

export interface MisplacementResult {
  /** 원래 인덱스별로, 전체를 올바르게 정렬했을 때의 0-based 순번 */
  correctOrder: number[]
  /** 원래 인덱스별로 "제자리(정상 배열)"인지 여부 */
  inPlace: boolean[]
  /** 오배열로 판정된 책들의 이동 안내 목록 */
  moves: MoveInstruction[]
}

/**
 * 실제 배열(사진 왼→오른, items 순서)과 정렬 엔진이 계산한 올바른 순서를 비교해
 * 오배열 도서를 찾는다. 단순히 "정렬 후 인덱스가 바뀐 모든 책"을 오배열로 잡으면
 * 책 한 권이 옮겨질 때 그 책이 지나간 자리의 책들까지 전부 오배열로 잡히므로,
 * 최장 증가 부분수열(LIS)로 이미 상대적으로 올바른 순서를 이루는 "정상 배열
 * 다수"를 찾고, 거기 속하지 않은 책만 오배열로 표시한다.
 */
export function computeMisplacement(items: ParsedCallNumber[]): MisplacementResult {
  const n = items.length
  const indices = items.map((_, i) => i)
  const sortedIndices = [...indices].sort(
    (i, j) => compareCallNumbers(items[i], items[j]) || i - j,
  )

  const correctOrder = new Array<number>(n)
  sortedIndices.forEach((originalIndex, rank) => {
    correctOrder[originalIndex] = rank
  })

  const backboneIndices = longestIncreasingSubsequenceIndices(correctOrder)
  const inPlace = new Array<boolean>(n).fill(false)
  backboneIndices.forEach((i) => {
    inPlace[i] = true
  })

  // "이 프레임의 정상 배열" 범위: 제자리인 책들의 청구기호 최소~최대.
  // 제자리인 책이 거의 없으면(신뢰 불가) 프레임 전체 범위로 대체한다.
  const rangeSourceIndices = backboneIndices.length > 0 ? backboneIndices : indices
  let normalMin = items[rangeSourceIndices[0]]
  let normalMax = items[rangeSourceIndices[0]]
  for (const i of rangeSourceIndices) {
    if (compareCallNumbers(items[i], normalMin) < 0) normalMin = items[i]
    if (compareCallNumbers(items[i], normalMax) > 0) normalMax = items[i]
  }

  const moves: MoveInstruction[] = []
  for (let i = 0; i < n; i++) {
    if (inPlace[i]) continue
    const item = items[i]
    const withinFrame =
      compareCallNumbers(item, normalMin) >= 0 && compareCallNumbers(item, normalMax) <= 0
    moves.push({ index: i, targetSlot: correctOrder[i] + 1, withinFrame })
  }

  return { correctOrder, inPlace, moves }
}

/** seq(순열)에 대해 최장 "증가" 부분수열을 이루는 원소들의 원래 인덱스를 오름차순으로 반환한다. */
function longestIncreasingSubsequenceIndices(seq: number[]): number[] {
  const n = seq.length
  if (n === 0) return []

  // tails[k] = 길이 k+1인 증가 부분수열 중 마지막 값이 가장 작은 수열의, seq상의 인덱스
  const tails: number[] = []
  const prev = new Array<number>(n).fill(-1)

  for (let i = 0; i < n; i++) {
    let lo = 0
    let hi = tails.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (seq[tails[mid]] < seq[i]) lo = mid + 1
      else hi = mid
    }
    if (lo > 0) prev[i] = tails[lo - 1]
    if (lo === tails.length) tails.push(i)
    else tails[lo] = i
  }

  const result: number[] = []
  let k = tails[tails.length - 1]
  while (k !== -1) {
    result.push(k)
    k = prev[k]
  }
  result.reverse()
  return result
}
