// 청구기호 구조: [별치기호] 분류기호 도서기호 [부가기호]
// 예) 004.73 박25ㅇ  /  아 843.5 23ㅇ v.2  /  004.73 박883ㅇ v.2026  /  004.73 반44초 c.2

export interface ClassificationCode {
  raw: string
  /** '.' 앞 정수부 (예: "004") */
  intPart: string
  /** '.' 뒤 소수부, 없으면 '' */
  fracPart: string
}

export interface BookNumber {
  raw: string
  /** 저자기호 앞 한글 */
  authorLetter: string
  /** 저자기호 숫자 (자연수가 아니라 소수 자리처럼 비교됨) */
  number: string
  /** 저작기호 뒤 한글 */
  workLetter: string
  /** 도서기호 토큰이 [가-힣ㄱ-ㅎ]+\d+[가-힣ㄱ-ㅎ]* 형태로 분해되지 않은 경우 */
  parseFailed: boolean
}

export type SupplementKind = 'v' | 'c' | 'year'

export interface Supplement {
  raw: string
  kind: SupplementKind
  number: number
}

export interface ParsedCallNumber {
  /** 편집 가능한 원본 표시 텍스트 */
  raw: string
  /** 별치기호, 없으면 null */
  prefix: string | null
  classification: ClassificationCode | null
  bookNumber: BookNumber | null
  supplements: Supplement[]
  /** 어떤 분류에도 속하지 못한 토큰들 (사용자가 편집 단계에서 고쳐야 함) */
  unparsedTokens: string[]
  /** classification/bookNumber가 없거나 bookNumber 분해 실패, 또는 unparsedTokens가 있으면 true */
  parseFailed: boolean
}

/** 사진 한 장(프레임) 안에서 인식/편집된 도서 한 권 */
export interface ShelfItem {
  id: string
  /** 사진 속 왼쪽→오른쪽 순서 (0-based) */
  position: number
  parsed: ParsedCallNumber
}
