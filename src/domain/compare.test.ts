import { describe, expect, it } from 'vitest'
import { compareCallNumbers } from './compare'
import { compareHangulString } from './hangul'
import { parseCallNumber } from './parse'

function sortRaw(list: string[]): string[] {
  return [...list]
    .map(parseCallNumber)
    .sort(compareCallNumbers)
    .map((p) => p.raw)
}

describe('compareHangulString', () => {
  it('orders 초성 per the given consonant table', () => {
    expect(compareHangulString('가', '까')).toBeLessThan(0)
    expect(compareHangulString('까', '나')).toBeLessThan(0)
    expect(compareHangulString('사', '아')).toBeLessThan(0)
  })

  it('orders 중성 per the given vowel table, ㅣ always last', () => {
    expect(compareHangulString('가', '개')).toBeLessThan(0) // ㅏ < ㅐ
    expect(compareHangulString('고', '과')).toBeLessThan(0) // ㅗ < ㅘ
    expect(compareHangulString('그', '기')).toBeLessThan(0) // ㅡ < ㅣ
  })

  it('treats the empty string as smallest ("없으면 먼저")', () => {
    expect(compareHangulString('', '아')).toBeLessThan(0)
    expect(compareHangulString('아', '')).toBeGreaterThan(0)
    expect(compareHangulString('', '')).toBe(0)
  })
})

describe('compareCallNumbers — classification (decimal comparison)', () => {
  it('compares integer part as a natural number (004 -> 4, 241 -> 241)', () => {
    expect(sortRaw(['241.1 김1', '004.1 김1'])).toEqual(['004.1 김1', '241.1 김1'])
  })

  it('compares fractional part digit-by-digit like a decimal, not as an integer', () => {
    // .214 < .34 < .57  (2 < 3 < 5 at the first differing digit)
    const sorted = sortRaw(['004.57 김1', '004.214 김1', '004.34 김1'])
    expect(sorted).toEqual(['004.214 김1', '004.34 김1', '004.57 김1'])
  })
})

describe('compareCallNumbers — book number (decimal-place comparison, NOT integer)', () => {
  it('마214 < 마34 < 마57, matching 0.214 < 0.34 < 0.57', () => {
    const sorted = sortRaw(['004.73 마57', '004.73 마214', '004.73 마34'])
    expect(sorted).toEqual(['004.73 마214', '004.73 마34', '004.73 마57'])
  })

  it('shorter digit string sorts first when it is a prefix ("34" < "349")', () => {
    const sorted = sortRaw(['004.73 마349', '004.73 마34'])
    expect(sorted).toEqual(['004.73 마34', '004.73 마349'])
  })

  it('never regresses to integer comparison (214 > 57 would be wrong)', () => {
    // If this were compared with parseInt, 마214 (214) > 마57 (57) and the sort
    // below would come out reversed.
    const sorted = sortRaw(['004.73 마214', '004.73 마57'])
    expect(sorted).toEqual(['004.73 마214', '004.73 마57'])
  })
})

describe('compareCallNumbers — author letter and work letter', () => {
  it('breaks ties on the author letter (앞한글) using 한글 자모 순', () => {
    const sorted = sortRaw(['004.73 하25', '004.73 가25'])
    expect(sorted).toEqual(['004.73 가25', '004.73 하25'])
  })

  it('missing work letter (저작기호) sorts before a present one', () => {
    const sorted = sortRaw(['004.73 김25초', '004.73 김25'])
    expect(sorted).toEqual(['004.73 김25', '004.73 김25초'])
  })
})

describe('compareCallNumbers — 별치기호', () => {
  it('sorts non-prefixed items before prefixed ones, then by prefix text', () => {
    const sorted = sortRaw(['카 004.73 김25', '004.73 김25', '아 004.73 김25'])
    expect(sorted).toEqual(['004.73 김25', '아 004.73 김25', '카 004.73 김25'])
  })
})

describe('compareCallNumbers — 부가기호', () => {
  it('compares the trailing number as a natural number', () => {
    const sorted = sortRaw(['004.73 김25 v.10', '004.73 김25 v.2'])
    expect(sorted).toEqual(['004.73 김25 v.2', '004.73 김25 v.10'])
  })

  it('missing supplement sorts before a present one', () => {
    const sorted = sortRaw(['004.73 김25 v.1', '004.73 김25'])
    expect(sorted).toEqual(['004.73 김25', '004.73 김25 v.1'])
  })
})

describe('compareCallNumbers — full worked examples from the spec', () => {
  it('sorts the four example call numbers into a stable, well-defined order', () => {
    const examples = ['004.73 박25ㅇ', '아 843.5 23ㅇ v.2', '004.73 박883ㅇ v.2026', '004.73 반44초 c.2']
    const sorted = sortRaw(examples)
    // Non-prefixed items (004.73 ...) come before the 별치 item (아 843.5 ...).
    expect(sorted[3]).toBe('아 843.5 23ㅇ v.2')
    // Among the three 004.73 items: author letters 박 < 반 (가나다 순), and
    // between the two 박 entries, 박25ㅇ (number "25") < 박883ㅇ (number "883")
    // because "25" and "883" first differ at '2' < '8'.
    expect(sorted.slice(0, 3)).toEqual(['004.73 박25ㅇ', '004.73 박883ㅇ v.2026', '004.73 반44초 c.2'])
  })
})
