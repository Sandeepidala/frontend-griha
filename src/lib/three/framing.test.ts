import { describe, expect, it } from 'vitest'
import { houseFrame } from './framing'

describe('houseFrame', () => {
  it('aims at the middle of the house, not the plot, and sizes to the house', () => {
    // An 80 × 145 ft plot with a 30 × 40 ft house near its front corner.
    const frame = houseFrame({ width: 80, height: 145 }, [
      { x: 5, y: 10, width: 30, height: 20 },
      { x: 5, y: 30, width: 20, height: 20 },
    ])
    expect(frame.center).toEqual({ x: 20 - 40, z: 30 - 72.5 })
    expect(frame.size).toBe(40)
  })

  it('frames the whole plot when there is no house, and never zooms in on a tiny plan', () => {
    expect(houseFrame({ width: 30, height: 40 }, [])).toEqual({ center: { x: 0, z: 0 }, size: 40 })
    expect(houseFrame({ width: 30, height: 40 }, [{ x: 10, y: 10, width: 6, height: 5 }]).size).toBe(16)
  })
})
