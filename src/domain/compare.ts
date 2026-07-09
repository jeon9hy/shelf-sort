import { compareHangulString } from './hangul'
import type { ParsedCallNumber } from './types'

function compareIntPart(a: string, b: string): number {
  return parseInt(a || '0', 10) - parseInt(b || '0', 10)
}

/**
 * 분류기호 소수부 비교. "소수의 크기"로 비교해야 하므로 부족한 자리는 오른쪽에
 * '0'을 채워 문자열로 비교한다 (0.2 vs 0.234 -> "200" vs "234", 2 < 2에서 다음 자리로).
 * 이는 실제 십진수 값 비교와 동일하다.
 */
function compareDecimalFraction(a: string, b: string): number {
  const len = Math.max(a.length, b.length)
  const pa = a.padEnd(len, '0')
  const pb = b.padEnd(len, '0')
  if (pa === pb) return 0
  return pa < pb ? -1 : 1
}

/**
 * 도서기호 숫자 비교. ★가장 중요★ 자연수 크기가 아니라 왼쪽 자리부터 하나씩 비교하는
 * 사전식(lexicographic) 비교다 — 한쪽이 다른 쪽의 접두어면 짧은 쪽이 작다.
 * "34" < "349",  "214" < "34" < "57" (2 < 3 < 5에서 갈림).
 * 절대 parseInt로 정수 비교하지 않는다 (214 > 57로 뒤집히는 오류를 방지).
 */
function compareDigitStringLexicographic(a: string, b: string): number {
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
  }
  return a.length - b.length
}

/**
 * 두 청구기호의 정렬 순서를 비교한다. 아래 순서대로 비교하며, 앞 항목에서 우열이
 * 갈리면 그 자리에서 확정한다:
 *   1) 별치기호(문자순, 없으면 먼저)
 *   2) 분류기호(정수부 자연수 비교 -> 소수부 소수 크기 비교)
 *   3) 도서기호 앞 한글(저자기호 문자, 한글 자모 순)
 *   4) 도서기호 숫자(사전식 비교, 절대 자연수 비교 아님)
 *   5) 도서기호 뒤 한글(저작기호, 한글 자모 순, 없으면 먼저)
 *   6) 부가기호(뒤 숫자를 자연수로 비교, 없으면 먼저)
 */
export function compareCallNumbers(a: ParsedCallNumber, b: ParsedCallNumber): number {
  // 1. 별치기호. compareHangulString은 빈 문자열을 항상 가장 작게 취급하므로
  // "없으면 먼저"가 자연스럽게 성립한다.
  const prefixCompare = compareHangulString(a.prefix ?? '', b.prefix ?? '')
  if (prefixCompare !== 0) return prefixCompare

  // 2. 분류기호
  const aCls = a.classification
  const bCls = b.classification
  if (aCls && bCls) {
    const intCompare = compareIntPart(aCls.intPart, bCls.intPart)
    if (intCompare !== 0) return intCompare
    const fracCompare = compareDecimalFraction(aCls.fracPart, bCls.fracPart)
    if (fracCompare !== 0) return fracCompare
  } else if (!!aCls !== !!bCls) {
    // 분류기호를 파싱하지 못한(편집이 필요한) 항목은 앞쪽에 모아 눈에 띄게 한다.
    return aCls ? 1 : -1
  }

  // 3. 도서기호 앞 한글(저자기호 문자)
  const aBook = a.bookNumber
  const bBook = b.bookNumber
  const authorCompare = compareHangulString(aBook?.authorLetter ?? '', bBook?.authorLetter ?? '')
  if (authorCompare !== 0) return authorCompare

  // 4. 도서기호 숫자
  const numberCompare = compareDigitStringLexicographic(aBook?.number ?? '', bBook?.number ?? '')
  if (numberCompare !== 0) return numberCompare

  // 5. 도서기호 뒤 한글(저작기호)
  const workCompare = compareHangulString(aBook?.workLetter ?? '', bBook?.workLetter ?? '')
  if (workCompare !== 0) return workCompare

  // 6. 부가기호
  const aSupp = a.supplements[0]?.number
  const bSupp = b.supplements[0]?.number
  if (aSupp === undefined && bSupp === undefined) return 0
  if (aSupp === undefined) return -1
  if (bSupp === undefined) return 1
  return aSupp - bSupp
}
