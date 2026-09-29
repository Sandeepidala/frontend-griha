import { describe, expect, it } from 'vitest'
import { DEFAULT_BRIEF } from '@/lib/brief'
import { EXTERIOR_WALL, intersects, requiredSetbacks } from '@/lib/drawings/geometry'
import type { ProjectBrief } from '@/types/brief'
import type { Floor, Plot } from '@/types/design'
import { generateOptions, type GeneratedOption } from '.'
import { bedroomsPerFloor } from './program'
import { requirementsFor } from '@/lib/byelaws'

function plot(overrides: Partial<Plot> = {}): Plot {
  return { width: 30, height: 40, facing: 'north', units: 'ft', setbacks: { front: 3, rear: 2, left: 2, right: 2 }, ...overrides }
}

function brief(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  return { ...DEFAULT_BRIEF, city: null, ...overrides }
}

function generate(p: Plot, b: ProjectBrief, seed?: number) {
  const result = generateOptions({ plot: p, brief: b, budget: { amount: 5e6, turnkey: false }, seed })
  if (!result.ok) throw new Error(result.reason)
  return result
}

const rooms = (option: GeneratedOption) => option.floors.flatMap((f) => f.rooms)
const count = (option: GeneratedOption, type: string) => rooms(option).filter((r) => r.type === type).length

describe('generateOptions', () => {
  const G1 = brief({ floors: 2, bedrooms: 3, bathrooms: 3, parkingCars: 1, extraRooms: ['quiet_room', 'store_room'] })

  it('returns four distinct, labelled options, each scored and costed', () => {
    const { options } = generate(plot(), G1)
    expect(options.map((o) => o.label)).toEqual(['Option A', 'Option B', 'Option C', 'Option D'])
    for (const o of options) {
      expect(o.report.score).toBeGreaterThan(0)
      expect(o.estimate.total).toBeGreaterThan(0)
      expect(o.floors).toHaveLength(2)
    }
    const signatures = new Set(options.map((o) => JSON.stringify(rooms(o).map((r) => [r.x, r.y, r.width, r.height]))))
    expect(signatures.size).toBe(4)
  })

  it('provides every bedroom and bathroom in the brief, and the extra rooms', () => {
    for (const o of generate(plot(), G1).options) {
      expect(count(o, 'bedroom')).toBe(3)
      expect(count(o, 'wet')).toBe(3)
      expect(rooms(o).some((r) => r.name === 'Quiet Room')).toBe(true)
      expect(rooms(o).some((r) => r.name === 'Store Room')).toBe(true)
      expect(o.floors[0].rooms.some((r) => r.name === 'Parking')).toBe(true)
    }
  })

  it('keeps every room inside the setbacks (with room for the outer walls) and never overlaps rooms', () => {
    const p = plot()
    const s = requiredSetbacks(p)
    for (const o of generate(p, G1).options) {
      for (const floor of o.floors) {
        for (const r of floor.rooms) {
          expect(r.x).toBeGreaterThanOrEqual(s.W + EXTERIOR_WALL - 0.01)
          expect(r.y).toBeGreaterThanOrEqual(s.N + EXTERIOR_WALL - 0.01)
          expect(r.x + r.width).toBeLessThanOrEqual(p.width - s.E - EXTERIOR_WALL + 0.01)
          expect(r.y + r.height).toBeLessThanOrEqual(p.height - s.S - EXTERIOR_WALL + 0.01)
        }
        for (let i = 0; i < floor.rooms.length; i++) {
          for (let j = i + 1; j < floor.rooms.length; j++) expect(intersects(floor.rooms[i], floor.rooms[j])).toBe(false)
        }
      }
    }
  })

  it('plans to the bye-laws: required setbacks even when the plot’s own are lower, and coverage within the limit', () => {
    const p = plot({ width: 40, height: 60, setbacks: { front: 0, rear: 0, left: 0, right: 0 } })
    const rules = requirementsFor(p, G1)
    for (const o of generate(p, G1).options) {
      const compliance = o.report.results.filter((r) => r.category === 'compliance' && r.id.startsWith('law-setback'))
      expect(compliance.map((r) => r.status)).toEqual(['pass'])
      for (const r of o.floors[0].rooms) {
        expect(r.y).toBeGreaterThanOrEqual(rules.setbacks.front + EXTERIOR_WALL - 0.01)
        expect(r.y + r.height).toBeLessThanOrEqual(60 - rules.setbacks.rear - EXTERIOR_WALL + 0.01)
      }
      expect(o.report.results.find((r) => r.id === 'law-coverage')?.status).toBe('pass')
    }
  })

  it('never lets a room past a setback line, for any facing or corner plot', () => {
    for (const facing of ['north', 'south', 'east', 'west'] as const) {
      const p = plot({ width: 35, height: 45, facing })
      const b = brief({ floors: 2, bedrooms: 3, bathrooms: 3, parkingCars: 1, kitchenType: 'open', extraRooms: ['home_office', 'utility_room'], cornerPlot: true })
      for (const o of generate(p, b).options) {
        const failed = o.report.results.filter((r) => r.id.startsWith('law-setback-') || r.id.startsWith('site-setback-'))
        expect(failed.map((r) => `${facing}: ${r.title}`)).toEqual([])
      }
    }
  })

  it('lines the staircase up on every floor and puts upper rooms over ground-floor rooms', () => {
    // Share of the upper floor's room area that has a ground-floor room underneath it.
    const covered = (upper: Floor, ground: Floor) => {
      const overlap = (a: Floor['rooms'][number], b: Floor['rooms'][number]) =>
        Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
      const area = upper.rooms.reduce((s, r) => s + r.width * r.height, 0)
      const under = upper.rooms.reduce((s, r) => s + ground.rooms.reduce((t, g) => t + overlap(r, g), 0), 0)
      return under / area
    }
    for (const o of generate(plot(), G1).options) {
      const stairs = o.floors.map((f) => f.rooms.find((r) => r.name === 'Staircase'))
      expect(stairs.every(Boolean)).toBe(true)
      for (const stair of stairs) expect([stair!.x, stair!.y, stair!.width, stair!.height]).toEqual([stairs[0]!.x, stairs[0]!.y, stairs[0]!.width, stairs[0]!.height])
      expect(covered(o.floors[1], o.floors[0])).toBeGreaterThanOrEqual(0.9)
    }
  })

  it('fits a real car bay and staircase when the plot allows', () => {
    const [best] = generate(plot({ width: 40, height: 60 }), G1).options
    const parking = best.floors[0].rooms.find((r) => r.name === 'Parking')!
    expect(Math.max(parking.width, parking.height)).toBeGreaterThanOrEqual(16.5)
    expect(Math.min(parking.width, parking.height)).toBeGreaterThanOrEqual(8.5)
    const stair = best.floors[0].rooms.find((r) => r.name === 'Staircase')!
    expect(Math.min(stair.width, stair.height)).toBeGreaterThanOrEqual(7)
  })

  it('works for every road facing', () => {
    for (const facing of ['north', 'south', 'east', 'west'] as const) {
      const { options } = generate(plot({ width: 35, height: 50, facing }), G1)
      expect(options.length).toBeGreaterThan(0)
      expect(options[0].report.categories.find((c) => c.category === 'space')?.score).toBeGreaterThanOrEqual(80)
    }
  })

  it('sizes the house to the brief on a large plot, leaving the rest open', () => {
    const [best] = generate(plot({ width: 60, height: 90 }), brief({ floors: 1, bedrooms: 2, bathrooms: 2, parkingCars: 0 })).options
    const area = best.floors[0].rooms.reduce((s, r) => s + r.width * r.height, 0)
    expect(area).toBeLessThan(60 * 90 * 0.35)
  })

  it('is repeatable for the same brief and seed, and varies with the seed', () => {
    const a = generate(plot(), G1, 7).options.map((o) => rooms(o))
    const b = generate(plot(), G1, 7).options.map((o) => rooms(o))
    const c = generate(plot(), G1, 8).options.map((o) => rooms(o))
    expect(a).toEqual(b)
    expect(c).not.toEqual(a)
  })

  it('notes when the brief is bigger than the plot comfortably holds', () => {
    const { notes } = generate(plot({ width: 20, height: 30 }), brief({ floors: 3, bedrooms: 3, bathrooms: 3, parkingCars: 1 }))
    expect(notes.some((n) => n.includes('sq ft on its busiest floor'))).toBe(true)
  })

  it('refuses a plot too small to build on', () => {
    const result = generateOptions({ plot: plot({ width: 15, height: 20 }), brief: brief(), budget: null })
    expect(result).toEqual({ ok: false, reason: expect.stringContaining('too small') })
  })
})

describe('bedroomsPerFloor', () => {
  it('keeps a single-storey house on one floor', () => {
    expect(bedroomsPerFloor(brief({ floors: 1, bedrooms: 3 }), 900, 0)).toEqual([3])
  })

  it('puts bedrooms upstairs first, and one on the ground floor when briefed', () => {
    expect(bedroomsPerFloor(brief({ floors: 2, bedrooms: 3, needsGroundFloorBedroom: false }), 800, 0)[0]).toBe(0)
    expect(bedroomsPerFloor(brief({ floors: 2, bedrooms: 3, needsGroundFloorBedroom: true }), 800, 0)[0]).toBe(1)
    const spread = bedroomsPerFloor(brief({ floors: 3, bedrooms: 5 }), 800, 0)
    expect(spread.reduce((s, n) => s + n, 0)).toBe(5)
  })
})
