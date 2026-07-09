// 한글 자모 비교 유틸.
//
// 자음(초성) 순서: ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ
// 모음(중성) 순서: ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ
// 이 두 순서표는 유니코드 완성형 음절(가-힣) 인코딩의 초성/중성 인덱스 순서와 동일하다.
// 종성(받침) 순서는 자료에 명시되지 않아 유니코드 종성 인덱스(없음-첫순위, 이후 자모 순)를 그대로 사용한다.
export const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

export const JUNGSUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
]

export const JONGSUNG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
]

const SYLLABLE_BASE = 0xac00
const SYLLABLE_LAST = 0xd7a3

function isSyllable(code: number): boolean {
  return code >= SYLLABLE_BASE && code <= SYLLABLE_LAST
}

interface DecomposedSyllable {
  cho: number
  jung: number
  jong: number
}

function decomposeSyllable(code: number): DecomposedSyllable {
  const idx = code - SYLLABLE_BASE
  const cho = Math.floor(idx / (JUNGSUNG.length * JONGSUNG.length))
  const jung = Math.floor((idx % (JUNGSUNG.length * JONGSUNG.length)) / JONGSUNG.length)
  const jong = idx % JONGSUNG.length
  return { cho, jung, jong }
}

/** 한 글자를 비교한다. 음절(가-힣)은 초성→중성→종성 순으로, 단일 자모는 초성표 인덱스로 비교한다. */
function compareHangulChar(a: string, b: string): number {
  const ca = a.codePointAt(0)!
  const cb = b.codePointAt(0)!
  const syllableA = isSyllable(ca)
  const syllableB = isSyllable(cb)

  if (syllableA && syllableB) {
    const da = decomposeSyllable(ca)
    const db = decomposeSyllable(cb)
    if (da.cho !== db.cho) return da.cho - db.cho
    if (da.jung !== db.jung) return da.jung - db.jung
    return da.jong - db.jong
  }

  if (!syllableA && !syllableB) {
    const ia = CHOSUNG.indexOf(a)
    const ib = CHOSUNG.indexOf(b)
    if (ia !== -1 && ib !== -1) return ia - ib
    return ca - cb
  }

  // 음절과 단일 자모가 섞여 비교되는 경우는 실제 데이터에서는 발생하지 않지만,
  // 안전하게 코드포인트 비교로 대체한다.
  return ca - cb
}

/** 문자열 단위 한글 비교. 빈 문자열은 항상 가장 작다("없으면 먼저" 규칙과 자연스럽게 맞물린다). */
export function compareHangulString(a: string, b: string): number {
  const charsA = Array.from(a)
  const charsB = Array.from(b)
  const len = Math.min(charsA.length, charsB.length)
  for (let i = 0; i < len; i++) {
    const c = compareHangulChar(charsA[i], charsB[i])
    if (c !== 0) return c
  }
  return charsA.length - charsB.length
}
