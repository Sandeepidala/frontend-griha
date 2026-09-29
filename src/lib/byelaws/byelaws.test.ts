import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_BRIEF } from '@/lib/brief'
import { runDesignCheck } from '@/lib/designCheck'
import type { ProjectBrief } from '@/types/brief'
import type { Floor, Plot, Room, RoomType } from '@/types/design'
import { BYELAW_SETS, GENERIC_PLACEHOLDER, byeLawSetFor, compliantSetbacks, requirementsFor } from '.'

const plot = (overrides: Partial<Plot> = {}): Plot => ({
  width: 30,
  height: 40,
  facing: 'north',
  units: 'ft',
  setbacks: { front: 0, rear: 0, left: 0, right: 0 },
  ...overrides,
})
const brief = (overrides: Partial<ProjectBrief> = {}): ProjectBrief => ({ ...DEFAULT_BRIEF, vastu: false, ...overrides })

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
const floor = (rooms: Room[], level = 0): Floor => ({
  id: `f${level}`,
  name: `Floor ${level}`,
  level,
  elevation: level * 10,
  rooms,
  wallOverrides: {},
  openings: [],
  furniture: [],
  staircases: [],
  guides: { vertical: [], horizontal: [] },
})
const results = (p: Plot, floors: Floor[], b = brief()) =>
  runDesignCheck({ plot: p, floors, brief: b }).results.filter((r) => r.category === 'compliance')
const find = (list: ReturnType<typeof results>, id: string) => list.find((r) => r.id === id)

describe('requirementsFor', () => {
  it('sets setbacks by plot depth (front, rear) and frontage (sides)', () => {
    // 30 ft frontage (9.1 m) and 40 ft depth (12.2 m) on a north-facing plot.
    expect(requirementsFor(plot(), brief()).setbacks).toEqual({ front: 4.9, rear: 3.3, left: 3.3, right: 3.3 })
    // East-facing: the 40 ft side is the frontage and the 30 ft side the depth.
    expect(requirementsFor(plot({ facing: 'east' }), brief()).setbacks).toEqual({ front: 3.3, rear: 2.5, left: 3.9, right: 3.9 })
  })

  it('takes coverage and parking from the plot area', () => {
    const small = requirementsFor(plot({ width: 20, height: 30 }), brief()) // 55.7 m²
    const large = requirementsFor(plot({ width: 60, height: 90 }), brief()) // 501.7 m²
    expect([small.maxCoverage, small.parkingCars]).toEqual([0.75, 0])
    expect([large.maxCoverage, large.parkingCars]).toEqual([0.55, 2])
  })

  it('takes FAR and height from the road width, assuming one when it is not given', () => {
    const assumed = requirementsFor(plot(), brief({ roadWidthFt: null }))
    expect([assumed.far, assumed.maxHeightFt, assumed.roadWidthFt]).toEqual([1.75, 37.7, 30])
    expect(assumed.assumptions).toEqual(['Road width not given in the brief; assumed about 30 ft (9 m).'])
    const wide = requirementsFor(plot(), brief({ roadWidthFt: 40 }))
    expect([wide.far, wide.maxHeightFt, wide.assumptions]).toEqual([2.25, 49.2, []])
  })

  it('reminds about the second road on a corner plot', () => {
    expect(requirementsFor(plot(), brief({ cornerPlot: true, roadWidthFt: 30 })).assumptions[0]).toMatch(/Corner plot/)
  })

  it('raises setbacks to what the rules require, never lowers them', () => {
    expect(compliantSetbacks({ front: 6, rear: 1, left: 2, right: 5 }, { front: 4.9, rear: 3.3, left: 3.3, right: 3.3 })).toEqual({
      front: 6,
      rear: 3.3,
      left: 3.3,
      right: 5,
    })
  })
})

describe('byeLawSetFor', () => {
  afterEach(() => {
    BYELAW_SETS.splice(0)
  })

  it('uses the generic placeholder unless a real set matches the state and city', () => {
    expect(byeLawSetFor(brief({ state: 'Karnataka', city: 'Mysuru' }))).toBe(GENERIC_PLACEHOLDER)
    const bengaluru = {
      ...GENERIC_PLACEHOLDER,
      id: 'ka-blr',
      name: 'Bengaluru',
      status: 'verified' as const,
      appliesTo: { states: ['Karnataka'], cities: /bengaluru|bangalore/i },
    }
    BYELAW_SETS.push(bengaluru)
    expect(byeLawSetFor(brief({ state: 'Karnataka', city: 'Bangalore' }))).toBe(bengaluru)
    expect(byeLawSetFor(brief({ state: 'Karnataka', city: 'Mysuru' }))).toBe(GENERIC_PLACEHOLDER)
  })
})

describe('the Bye-laws design check', () => {
  // A 40 × 60 north-facing plot (18.3 m deep, 12.2 m frontage) needs 9.8 ft front, 6.6 ft rear and 3.9 ft sides, and 1 car.
  const big = plot({ width: 40, height: 60 })
  const inside = () => [
    room('Parking', 'utility', 5, 11, 9, 16),
    room('Living', 'living', 14, 11, 20, 16),
    room('Bedroom', 'bedroom', 5, 27, 29, 20),
  ]

  it('passes a building inside the required setbacks, with parking, coverage, FAR and height in limits', () => {
    const list = results(big, [floor(inside())])
    expect(list.filter((r) => r.status !== 'pass')).toEqual([])
    expect(find(list, 'law-setbacks')?.title).toBe('Setbacks meet the bye-laws (front 9.8, rear 6.6, sides 3.9 ft)')
  })

  it('measures setbacks from the building and says when the plot’s own line is too low', () => {
    const tooClose = [...inside(), room('Store', 'utility', 34, 11, 5, 10)] // outer wall ~0.25 ft from the east edge
    const list = results(big, [floor(tooClose)])
    expect(find(list, 'law-setback-right')).toMatchObject({ status: 'fail', detail: expect.stringContaining('setback line is set to 0 ft') })
  })

  it('fails coverage, FAR, height and parking beyond the limits', () => {
    const full = (level: number) => floor([room('Bedroom', 'bedroom', 0, 0, 40, 60)], level)
    const list = results(big, [0, 1, 2, 3].map(full)) // four full storeys, no parking
    expect(find(list, 'law-coverage')?.status).toBe('fail')
    expect(find(list, 'law-far')?.status).toBe('fail')
    expect(find(list, 'law-height')).toMatchObject({ status: 'fail', title: 'Building height 40 ft over 4 storeys (limit 37.7 ft)' })
    expect(find(list, 'law-parking')).toMatchObject({ status: 'fail', title: 'Parking for 0 cars; the bye-laws require 1' })
  })
})
