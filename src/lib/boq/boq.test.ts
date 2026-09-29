import { describe, expect, it } from 'vitest'
import { DEFAULT_BRIEF } from '@/lib/brief'
import { SLAB_THICKNESS } from '@/lib/drawings/geometry'
import type { Floor, Plot, Room } from '@/types/design'
import { RATES, boqToCsv, estimateBoq, formatLakhs, type BoqEstimate } from '.'

function room(id: string, x: number, y: number, width: number, height: number, overrides: Partial<Room> = {}): Room {
  return {
    id,
    name: 'Living Room',
    type: 'living',
    x,
    y,
    width,
    height,
    rotation: 0,
    wallHeight: 9,
    elevation: 0,
    color: null,
    floorFinish: 'tile',
    locked: false,
    visible: true,
    label: null,
    notes: '',
    ...overrides,
  }
}

function floor(id: string, level: number, rooms: Room[]): Floor {
  return { id, name: level === 0 ? 'Ground Floor' : 'First Floor', level, elevation: level * 10, rooms, wallOverrides: {}, openings: [], furniture: [], staircases: [], guides: { vertical: [], horizontal: [] } }
}

const PLOT: Plot = { width: 40, height: 40, facing: 'north', units: 'ft', setbacks: { front: 0, rear: 0, left: 0, right: 0 } }
/** One 20 × 20 ft living room in the middle of a 40 × 40 plot. */
const BOX = [floor('g', 0, [room('living', 10, 10, 20, 20)])]

function estimate(overrides: Partial<Parameters<typeof estimateBoq>[0]> = {}) {
  return estimateBoq({ plot: PLOT, floors: BOX, brief: { ...DEFAULT_BRIEF, city: null }, budget: { amount: 50e5, turnkey: false }, ...overrides })
}

const lineOf = (e: BoqEstimate, sectionId: string, key: string) =>
  e.sections.find((s) => s.id === sectionId)?.lines.find((l) => l.rateKey === key)

describe('estimateBoq', () => {
  it('returns an empty estimate for a plan with no rooms', () => {
    const e = estimate({ floors: [floor('g', 0, [])] })
    expect(e.sections).toEqual([])
    expect(e.total).toBe(0)
  })

  it('prices room quantities from the plan geometry', () => {
    const e = estimate()
    expect(lineOf(e, 'room-living', 'floorTile')).toMatchObject({ quantity: 400, unit: 'sqft', rate: RATES.floorTile.rate, amount: 400 * RATES.floorTile.rate })
    expect(lineOf(e, 'room-living', 'ceilingFinish')?.quantity).toBe(400)
    // Walls: 80 ft of perimeter at clear height, less the room's doors and windows.
    const plaster = lineOf(e, 'room-living', 'plasterInternal')!.quantity
    expect(plaster).toBeLessThan(80 * (10 - SLAB_THICKNESS))
    expect(plaster).toBeGreaterThan(80 * (10 - SLAB_THICKNESS) - 150)
    // A living room on the road side gets the main door; its outside walls get windows.
    expect(lineOf(e, 'room-living', 'mainDoor')?.quantity).toBe(1)
    expect(lineOf(e, 'room-living', 'window')?.quantity).toBeGreaterThan(0)
  })

  it('builds the building-level sections', () => {
    const e = estimate()
    expect(e.sections.filter((s) => s.kind === 'building').map((s) => s.id)).toEqual(['foundation', 'structure', 'walls', 'services'])
    expect(lineOf(e, 'structure', 'rccSlab')?.quantity).toBeGreaterThan(0)
    expect(lineOf(e, 'walls', 'roofWaterproofing')?.quantity).toBe(400)
    expect(lineOf(e, 'structure', 'staircase')).toBeUndefined() // single storey
  })

  it('adds a staircase between two storeys and waterproofs only the uncovered roof', () => {
    const upper = floor('f', 1, [room('bed', 10, 10, 20, 12, { name: 'Bedroom', type: 'bedroom' })])
    const e = estimate({ floors: [...BOX, upper] })
    expect(lineOf(e, 'structure', 'staircase')?.quantity).toBeGreaterThanOrEqual(16)
    // Ground-floor terrace (400 − 240) plus the first-floor roof (240).
    expect(lineOf(e, 'walls', 'roofWaterproofing')?.quantity).toBe(400)
    expect(e.sections.find((s) => s.id === 'room-bed')?.title).toBe('Bedroom · First Floor')
  })

  it('adds interiors only for turnkey, and always reports what they would cost', () => {
    const construction = estimate()
    const turnkey = estimate({ includeInteriors: true })
    expect(construction.sections.flatMap((s) => s.lines).some((l) => l.interiors)).toBe(false)
    expect(turnkey.sections.flatMap((s) => s.lines).some((l) => l.interiors)).toBe(true)
    expect(turnkey.interiorItems).toBe(construction.interiorItems)
    expect(turnkey.itemsTotal).toBe(construction.itemsTotal + construction.interiorItems)
    // A turnkey budget includes interiors by default.
    expect(estimate({ budget: { amount: 50e5, turnkey: true } }).includeInteriors).toBe(true)
  })

  it('adds overhead and contingency, and compares with the budget', () => {
    const e = estimate()
    expect(e.overheads.map((o) => o.pct)).toEqual([0.1, 0.05])
    expect(e.total).toBe(e.itemsTotal + e.overheads.reduce((s, o) => s + o.amount, 0))
    expect(estimate({ budget: { amount: e.total, turnkey: false } }).budget?.status).toBe('within')
    expect(estimate({ budget: { amount: e.total / 1.05, turnkey: false } }).budget?.status).toBe('close')
    expect(estimate({ budget: { amount: e.total / 2, turnkey: false } }).budget).toMatchObject({ status: 'over' })
    expect(estimate({ budget: null }).budget).toBeNull()
  })

  it('scales every rate by the city’s location factor', () => {
    const base = estimate()
    const mumbai = estimate({ brief: { ...DEFAULT_BRIEF, city: 'Navi Mumbai' } })
    expect(mumbai.location).toEqual({ factor: 1.25, label: 'Mumbai region' })
    expect(lineOf(mumbai, 'room-living', 'floorTile')?.rate).toBe(Math.round(RATES.floorTile.rate * 1.25))
    expect(mumbai.total).toBeGreaterThan(base.total * 1.2)
    expect(base.location.factor).toBe(1)
  })

  it('reports built-up area and cost per sq ft', () => {
    const e = estimate()
    expect(e.builtUpArea).toBeGreaterThan(400) // rooms plus wall thickness
    expect(e.costPerSqft).toBe(Math.round(e.total / e.builtUpArea))
  })
})

describe('exports and formatting', () => {
  it('writes a CSV with the header block, every line, subtotals and totals', () => {
    const e = estimate()
    const csv = boqToCsv(e, 'Box, "Test" House')
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('Bill of Quantities,"Box, ""Test"" House"')
    expect(lines).toContain('Section,Item,Quantity,Unit,Rate (₹),Amount (₹)')
    expect(csv).toContain(`Living Room,Vitrified tile flooring,400,sq ft,${RATES.floorTile.rate},${400 * RATES.floorTile.rate}`)
    expect(lines.filter((l) => l.includes(',Subtotal,'))).toHaveLength(e.sections.length)
    expect(csv).toContain(`,Estimated total,,,,${e.total}`)
  })

  it('formats amounts in lakhs and crores', () => {
    expect(formatLakhs(4_550_000)).toBe('₹45.5 L')
    expect(formatLakhs(12_500_000)).toBe('₹1.25 Cr')
    expect(formatLakhs(46_056)).toBe('₹46,056')
    expect(formatLakhs(-46_056)).toBe('−₹46,056')
  })
})
