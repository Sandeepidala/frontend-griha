import { describe, expect, it } from 'vitest'
import { formatArea, formatLength } from './units'

describe('units', () => {
  it('formats areas in square feet or square metres', () => {
    expect(formatArea(120, 'ft')).toBe('120 sq ft')
    expect(formatArea(1234.6, 'ft')).toBe('1,235 sq ft')
    expect(formatArea(120, 'm')).toBe('11.1 m²')
  })

  it('formats lengths in feet or metres', () => {
    expect(formatLength(12.04, 'ft')).toBe("12'")
    expect(formatLength(10, 'm')).toBe('3.05m')
  })
})
