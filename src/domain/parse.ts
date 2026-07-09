import type { BookNumber, ClassificationCode, ParsedCallNumber, Supplement } from './types'

// 분류기호: 정수부 1~3자리, 소수부 옵션. 예) 004, 004.73, 843.5
const CLASSIFICATION_RE = /^\d{1,3}(?:\.\d+)?$/
// 부가기호(v./c.): 예) v.2, c.2, v.2026
const SUPPLEMENT_VC_RE = /^([vc])\.(\d+)$/i
// 부가기호(4자리 연도 단독 토큰): 예) 2026
const SUPPLEMENT_YEAR_RE = /^\d{4}$/
// 도서기호: 앞한글(저자기호 문자) + 숫자(저자기호) + 뒤한글(저작기호, 옵션)
const BOOK_RE = /^([가-힣ㄱ-ㅎ]+)(\d+)([가-힣ㄱ-ㅎ]*)$/
// 별치기호: 분류기호 앞에 오는 짧은 순수 한글 토큰
const PREFIX_RE = /^[가-힣]{1,4}$/

const HAS_HANGUL_RE = /[가-힣ㄱ-ㅎ]/
const HAS_DIGIT_RE = /\d/

function parseClassification(token: string): ClassificationCode {
  const dotIndex = token.indexOf('.')
  if (dotIndex === -1) {
    return { raw: token, intPart: token, fracPart: '' }
  }
  return {
    raw: token,
    intPart: token.slice(0, dotIndex),
    fracPart: token.slice(dotIndex + 1),
  }
}

function parseBookNumber(token: string): BookNumber {
  const match = token.match(BOOK_RE)
  if (!match) {
    return { raw: token, authorLetter: '', number: '', workLetter: '', parseFailed: true }
  }
  const [, authorLetter, number, workLetter] = match
  return { raw: token, authorLetter, number, workLetter: workLetter ?? '', parseFailed: false }
}

/**
 * 청구기호 한 줄을 파싱한다. 공백으로 토큰을 나눈 뒤 각 토큰을 분류기호 / 도서기호 /
 * 부가기호 / 별치기호 중 하나로 귀속시킨다. 실패한 토큰은 unparsedTokens에 담아
 * 편집 단계에서 사용자가 고칠 수 있게 한다.
 */
export function parseCallNumber(raw: string): ParsedCallNumber {
  const tokens = raw.trim().split(/\s+/).filter(Boolean)

  let prefix: string | null = null
  let classification: ClassificationCode | null = null
  let bookNumber: BookNumber | null = null
  const supplements: Supplement[] = []
  const unparsedTokens: string[] = []

  for (const token of tokens) {
    if (!classification && CLASSIFICATION_RE.test(token)) {
      classification = parseClassification(token)
      continue
    }

    const vcMatch = token.match(SUPPLEMENT_VC_RE)
    if (vcMatch) {
      supplements.push({
        raw: token,
        kind: vcMatch[1].toLowerCase() as 'v' | 'c',
        number: parseInt(vcMatch[2], 10),
      })
      continue
    }

    if (SUPPLEMENT_YEAR_RE.test(token)) {
      supplements.push({ raw: token, kind: 'year', number: parseInt(token, 10) })
      continue
    }

    if (HAS_HANGUL_RE.test(token) && HAS_DIGIT_RE.test(token)) {
      if (!bookNumber) {
        bookNumber = parseBookNumber(token)
      } else {
        unparsedTokens.push(token)
      }
      continue
    }

    if (!prefix && !classification && PREFIX_RE.test(token)) {
      prefix = token
      continue
    }

    unparsedTokens.push(token)
  }

  const parseFailed =
    !classification || !bookNumber || bookNumber.parseFailed || unparsedTokens.length > 0

  return { raw, prefix, classification, bookNumber, supplements, unparsedTokens, parseFailed }
}
