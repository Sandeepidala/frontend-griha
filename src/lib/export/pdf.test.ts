import { describe, expect, it } from 'vitest'
import { fullSetMarkup } from '@/components/drawings/exportSheets'
import { DEFAULT_BRIEF } from '@/lib/brief'
import { buildDrawingSet, sheetRegister } from '@/lib/drawings/sheets'
import type { Floor, Room, RoomType } from '@/types/design'
import { pdfSafeText } from './pdf'

let n = 0
const room = (name: string, type: RoomType, x: number, y: number, width: number, height: number): Room => ({
  id: `r${++n}`,
  name,
  type,
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
})
const floor = (rooms: Room[], level: number): Floor => ({
  id: `f${level}`,
  name: level === 0 ? 'Ground Floor' : 'First Floor',
  level,
  elevation: level * 10,
  rooms,
  wallOverrides: {},
  openings: [],
  furniture: [],
  staircases: [],
  guides: { vertical: [], horizontal: [] },
})

describe('pdfSafeText', () => {
  it('keeps Latin-1 and swaps what the built-in PDF fonts lack', () => {
    expect(pdfSafeText('₹48.6 L · 12′ × 10 — ok')).toBe('Rs 48.6 L · 12? × 10 - ok')
    expect(pdfSafeText('riser ≤ 7", tread ≥ 10" → NBC; 4½" wall; 16Ø')).toBe('riser <= 7", tread >= 10" -> NBC; 4½" wall; 16Ø')
    expect(pdfSafeText('Owner’s “brief”…')).toBe(`Owner's "brief"...`)
  })
})

describe('the drawing set', () => {
  const floors = [
    floor([room('Living Room', 'living', 4, 6, 12, 14), room('Kitchen', 'kitchen', 16, 6, 10, 14), room('Parking', 'utility', 4, 20, 22, 12)], 0),
    floor([room('Master Bedroom', 'bedroom', 4, 6, 22, 14), room('Bathroom 1', 'wet', 4, 20, 8, 6)], 1),
  ]
  const plot = { width: 30, height: 40, facing: 'north' as const, units: 'ft' as const, setbacks: { front: 5, rear: 3.5, left: 3.5, right: 3.5 } }
  const brief = { ...DEFAULT_BRIEF, city: 'Pune', state: 'Maharashtra', roadWidthFt: 30 }

  it('opens with the project summary and a cost sheet per floor', () => {
    const set = buildDrawingSet(plot, floors, 'Sharma Residence', 'Griha', { brief, budget: { amount: 4000000, turnkey: false } })
    const pages = fullSetMarkup(set, sheetRegister(floors))
    expect(pages.slice(0, 3).map((p) => p.code)).toEqual(['G-001', 'G-002A', 'G-002B'])
    const summary = pages[0].markup
    expect(summary).toContain('CLIENT BRIEF')
    expect(summary).toContain('Pune, Maharashtra')
    expect(summary).toContain('30 ft')
    expect(summary).toContain('BYE-LAWS')
    expect(summary).toContain('DESIGN CHECK')
    const firstFloorCost = pages[2].markup
    expect(firstFloorCost).toContain('ROOM-WISE COST — FIRST FLOOR')
    expect(firstFloorCost).toContain('Master Bedroom')
    expect(firstFloorCost).toContain('Estimated total')
  })

  it('draws the road the brief gives on the site plan', () => {
    const set = buildDrawingSet(plot, floors, 'Sharma Residence', 'Griha', { brief, budget: null })
    const site = fullSetMarkup(set, sheetRegister(floors)).find((p) => p.code === 'SP-01')!
    expect(site.markup).toContain('30&#x27;-0&quot; WIDE ROAD')
  })
})
