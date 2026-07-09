import { describe, expect, it } from 'vitest'
import { parseCallNumber } from './parse'

describe('parseCallNumber', () => {
  it('parses a plain classification + book number', () => {
    const r = parseCallNumber('004.73 박25ㅇ')
    expect(r.prefix).toBeNull()
    expect(r.classification).toEqual({ raw: '004.73', intPart: '004', fracPart: '73' })
    expect(r.bookNumber).toEqual({
      raw: '박25ㅇ',
      authorLetter: '박',
      number: '25',
      workLetter: 'ㅇ',
      parseFailed: false,
    })
    expect(r.supplements).toEqual([])
    expect(r.unparsedTokens).toEqual([])
    expect(r.parseFailed).toBe(false)
  })

  it('parses 별치기호 + supplement volume, flags an unparseable book token', () => {
    const r = parseCallNumber('아 843.5 23ㅇ v.2')
    expect(r.prefix).toBe('아')
    expect(r.classification).toEqual({ raw: '843.5', intPart: '843', fracPart: '5' })
    // "23ㅇ" does not start with hangul, so it cannot decompose into author+number+work
    expect(r.bookNumber?.raw).toBe('23ㅇ')
    expect(r.bookNumber?.parseFailed).toBe(true)
    expect(r.supplements).toEqual([{ raw: 'v.2', kind: 'v', number: 2 }])
    expect(r.parseFailed).toBe(true)
  })

  it('parses a v.<year> supplement token', () => {
    const r = parseCallNumber('004.73 박883ㅇ v.2026')
    expect(r.classification).toEqual({ raw: '004.73', intPart: '004', fracPart: '73' })
    expect(r.bookNumber).toEqual({
      raw: '박883ㅇ',
      authorLetter: '박',
      number: '883',
      workLetter: 'ㅇ',
      parseFailed: false,
    })
    expect(r.supplements).toEqual([{ raw: 'v.2026', kind: 'v', number: 2026 }])
    expect(r.parseFailed).toBe(false)
  })

  it('parses a c.<copy> supplement and a work-letter book number', () => {
    const r = parseCallNumber('004.73 반44초 c.2')
    expect(r.classification).toEqual({ raw: '004.73', intPart: '004', fracPart: '73' })
    expect(r.bookNumber).toEqual({
      raw: '반44초',
      authorLetter: '반',
      number: '44',
      workLetter: '초',
      parseFailed: false,
    })
    expect(r.supplements).toEqual([{ raw: 'c.2', kind: 'c', number: 2 }])
    expect(r.parseFailed).toBe(false)
  })

  it('parses a book number with no 저작기호 (work letter)', () => {
    const r = parseCallNumber('325.1 김34')
    expect(r.bookNumber).toEqual({
      raw: '김34',
      authorLetter: '김',
      number: '34',
      workLetter: '',
      parseFailed: false,
    })
  })

  it('recognizes a standalone 4-digit year as a supplement token', () => {
    const r = parseCallNumber('004.73 박25ㅇ 2020')
    expect(r.supplements).toEqual([{ raw: '2020', kind: 'year', number: 2020 }])
  })

  it('flags completely unrecognized tokens for user correction', () => {
    const r = parseCallNumber('??? 004.73 박25ㅇ')
    expect(r.unparsedTokens).toEqual(['???'])
    expect(r.parseFailed).toBe(true)
  })

  it('flags a missing classification token', () => {
    const r = parseCallNumber('박25ㅇ')
    expect(r.classification).toBeNull()
    expect(r.bookNumber?.authorLetter).toBe('박')
    expect(r.parseFailed).toBe(true)
  })

  it('handles empty input gracefully', () => {
    const r = parseCallNumber('')
    expect(r.classification).toBeNull()
    expect(r.bookNumber).toBeNull()
    expect(r.parseFailed).toBe(true)
  })
})
