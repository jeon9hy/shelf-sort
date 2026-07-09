import { describe, expect, it } from 'vitest'
import { computeMisplacement } from './misplacement'
import { parseCallNumber } from './parse'

function parseAll(raws: string[]) {
  return raws.map(parseCallNumber)
}

describe('computeMisplacement', () => {
  it('reports nothing misplaced when the shelf is already in order', () => {
    const items = parseAll(['004.1 가1', '004.2 나1', '004.3 다1'])
    const result = computeMisplacement(items)
    expect(result.inPlace).toEqual([true, true, true])
    expect(result.moves).toEqual([])
  })

  it('flags a single book swapped in the middle of the shelf and points to its target slot', () => {
    // Correct order is 가1, 나1, 다1, 라1. Shelf order swaps 나1 and 다1 in the middle,
    // so the misplaced book's own call number still sits inside the backbone's range.
    const items = parseAll(['004.1 가1', '004.3 다1', '004.2 나1', '004.4 라1'])
    const result = computeMisplacement(items)
    expect(result.moves.length).toBe(1)
    const move = result.moves[0]
    expect(move.index).toBe(1) // 다1
    expect(move.withinFrame).toBe(true)
    expect(move.targetSlot).toBe(3) // 다1 belongs in slot 3: 가,나,다,라
  })

  it('flags a misplaced item at the shelf boundary as belonging to another section', () => {
    // Only 3 items and the misplaced book is the frame's own global maximum, so the
    // "정상 배열" backbone (가1, 나1) does not span far enough to include it.
    const items = parseAll(['004.1 가1', '004.3 다1', '004.2 나1'])
    const result = computeMisplacement(items)
    expect(result.moves.length).toBe(1)
    expect(result.moves[0].index).toBe(1) // 다1
    expect(result.moves[0].withinFrame).toBe(false)
  })

  it('marks a book whose call number is smaller than the whole frame as belonging to another section', () => {
    // 001.x precedes every 004.x book on this shelf, so it can't have a slot inside this frame.
    const items = parseAll(['004.1 가1', '004.2 나1', '001.1 하1', '004.3 다1'])
    const result = computeMisplacement(items)
    const outOfFrame = result.moves.find((m) => m.index === 2)
    expect(outOfFrame).toBeDefined()
    expect(outOfFrame?.withinFrame).toBe(false)
  })

  it('marks a book whose call number is larger than the whole frame as belonging to another section', () => {
    const items = parseAll(['004.1 가1', '004.2 나1', '999.9 하1', '004.3 다1'])
    const result = computeMisplacement(items)
    const outOfFrame = result.moves.find((m) => m.index === 2)
    expect(outOfFrame).toBeDefined()
    expect(outOfFrame?.withinFrame).toBe(false)
  })

  it('computes a valid correctOrder permutation for an unsorted shelf', () => {
    const items = parseAll(['004.3 다1', '004.1 가1', '004.2 나1'])
    const result = computeMisplacement(items)
    expect(result.correctOrder).toEqual([2, 0, 1])
  })
})
