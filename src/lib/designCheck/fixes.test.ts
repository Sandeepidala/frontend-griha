import { describe, expect, it } from 'vitest'
import { DEFAULT_BRIEF } from '@/lib/brief'
import type { ProjectBrief } from '@/types/brief'
import type { Floor, Plot, Room, RoomType } from '@/types/design'
import { runDesignCheck } from '.'
import { planFix } from './fixes'

let nextId = 0

function room(name: string, type: RoomType, x: number, y: number, width: number, height: number, extra: Partial<Room> = {}): Room {
  return {
    id: `r${++nextId}`,
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
    ...extra,
  }
}

function floor(rooms: Room[], level = 0): Floor {
  return {
    id: `f${level}`,
    name: level === 0 ? 'Ground Floor' : `Floor ${level + 1}`,
    level,
    elevation: level * 10,
    rooms,
    wallOverrides: {},
    openings: [],
    furniture: [],
    staircases: [],
    guides: { vertical: [], horizontal: [] },
  }
}

/** 30 × 40 ft, north-facing, with 3 ft front (north), 2 ft rear and 2 ft side setback lines. */
function plot(overrides: Partial<Plot> = {}): Plot {
  return { width: 30, height: 40, facing: 'north', units: 'ft', setbacks: { front: 3, rear: 2, left: 2, right: 2 }, ...overrides }
}

const brief = (overrides: Partial<ProjectBrief> = {}): ProjectBrief => ({ ...DEFAULT_BRIEF, parkingCars: 0, bedrooms: 1, bathrooms: 1, vastu: false, ...overrides })

const check = (p: Plot, floors: Floor[], b = brief()) => runDesignCheck({ plot: p, floors, brief: b })

/** Runs the check, applies the fix of the first result whose id starts with `id`, and checks again. */
function fixFirst(p: Plot, floors: Floor[], id: string, b = brief()) {
  const result = check(p, floors, b).results.find((r) => r.id.startsWith(id) && r.status !== 'pass')
  expect(result?.fix, `${id} should offer a fix`).toBeDefined()
  const fix = planFix(result!.fix!, p, floors)
  const nextPlot = fix?.setbacks ? { ...p, setbacks: fix.setbacks } : p
  return { fix, after: fix ? check(nextPlot, fix.floors, b) : null }
}

const rooms = (floors: Floor[]) => floors.flatMap((f) => f.rooms)
const failing = (report: ReturnType<typeof check> | null, prefix: string) => report?.results.filter((r) => r.id.startsWith(prefix) && r.status !== 'pass') ?? []

describe('fixes from the design check', () => {
  it('moves the whole house, every floor together, back inside the setback lines', () => {
    // The house starts 1 ft from the west edge; the 2 ft left line plus the outer wall needs 2.75 ft.
    const floors = [
      floor([room('Living Room', 'living', 1, 6, 12, 12), room('Kitchen', 'kitchen', 13, 6, 9, 12)]),
      floor([room('Bedroom', 'bedroom', 1, 6, 12, 12)], 1),
    ]
    const { fix, after } = fixFirst(plot(), floors, 'site-setback-left')

    // It fits inside the bye-law's 3.3 ft side setbacks too, so it goes there rather than to the 2 ft line.
    expect(fix?.summary).toBe("Moved the house 3.1' east")
    expect(rooms(fix!.floors).map((r) => r.x)).toEqual([4.05, 16.05, 4.05])
    expect(failing(after, 'site-setback')).toEqual([])
    expect(failing(after, 'law-setback')).toEqual([])
  })

  it('trims rooms when the house is wider than the space between the lines', () => {
    // 26 ft wide; only 30 - 2 - 2 - 1.5 = 24.5 ft is buildable.
    const floors = [floor([room('Living Room', 'living', 2, 6, 14, 12), room('Kitchen', 'kitchen', 16, 6, 12, 12)])]
    const { fix, after } = fixFirst(plot(), floors, 'site-setback')

    expect(fix?.summary).toMatch(/trimmed (Living Room|Kitchen) to fit/)
    expect(failing(after, 'site-setback')).toEqual([])
    expect(rooms(fix!.floors).reduce((s, r) => s + r.width, 0)).toBeCloseTo(24.5)
  })

  it('raises setback lines below the bye-law minimum, then fits the house inside them', () => {
    const p = plot({ setbacks: { front: 0, rear: 0, left: 0, right: 0 } })
    const floors = [floor([room('Living Room', 'living', 1, 1, 12, 12), room('Bedroom', 'bedroom', 13, 1, 11, 12)])]
    const { fix, after } = fixFirst(p, floors, 'law-setback')

    expect(fix?.setbacks?.front).toBeGreaterThan(0)
    expect(fix?.summary).toMatch(/^Set the setback lines to the bye-law minimum, moved the house/)
    expect(failing(after, 'law-setback')).toEqual([])
    expect(failing(after, 'site-setback')).toEqual([])
  })

  it('lines the house up with whichever edge keeps every room usable', () => {
    // 33 ft deep where 30.3 ft is buildable. Lining up with the north edge would leave the bathroom at
    // the south end 1.3 ft deep; lining up with the south edge trims the parking instead.
    const p = plot({ setbacks: { front: 4.9, rear: 3.3, left: 3.3, right: 3.3 } })
    const floors = [floor([room('Parking', 'utility', 6, 4, 9, 12), room('Living Room', 'living', 6, 16, 14, 17), room('Bathroom', 'wet', 6, 33, 6, 4)])]
    const { fix, after } = fixFirst(p, floors, 'site-setback')

    expect(fix?.summary).toBe("Moved the house 1.1' north, trimmed Parking to fit")
    expect(rooms(fix!.floors).find((r) => r.name === 'Bathroom')).toMatchObject({ y: 31.95, height: 4 })
    expect(failing(after, 'site-setback')).toEqual([])
  })

  it('leaves a locked room where it is', () => {
    const floors = [floor([room('Living Room', 'living', 1, 6, 12, 12, { locked: true })])]
    const result = check(plot(), floors).results.find((r) => r.id === 'site-setback-left')
    expect(planFix(result!.fix!, plot(), floors)).toBeNull()
  })

  it('trims one of two overlapping rooms back to the shared wall, losing the least area', () => {
    const living = room('Living Room', 'living', 4, 6, 14, 12)
    const kitchen = room('Kitchen', 'kitchen', 16, 6, 9, 12) // 2 ft into the living room
    const { fix, after } = fixFirst(plot(), [floor([living, kitchen])], 'space-overlap')

    // Both lose 24 sq ft; that's a smaller share of the living room.
    expect(fix?.summary).toBe("Trimmed Living Room to 12' × 12' so it only shares a wall with Kitchen")
    expect(rooms(fix!.floors).find((r) => r.name === 'Living Room')).toMatchObject({ x: 4, width: 12 })
    expect(failing(after, 'space-overlap')).toEqual([])
  })

  it('grows a small room into the free space beside it', () => {
    const living = room('Living Room', 'living', 4, 6, 12, 12)
    const bedroom = room('Bedroom', 'bedroom', 16, 6, 7, 9) // 63 sq ft; at least 81 sq ft and 6.9 ft wide
    const { fix, after } = fixFirst(plot(), [floor([living, bedroom])], `space-min-${bedroom.id}`)

    const grown = rooms(fix!.floors).find((r) => r.id === bedroom.id)!
    expect(grown.x).toBe(16) // it can't take the living room's space
    expect(grown.width * grown.height).toBeGreaterThanOrEqual(80.5)
    expect(fix?.summary).toMatch(/^Made Bedroom .* \(was 7' × 9'\) using free space next to it$/)
    expect(failing(after, `space-min-${bedroom.id}`)).toEqual([])
    expect(failing(after, 'space-overlap')).toEqual([])
  })

  it('makes parking big enough for the cars in the brief', () => {
    const parking = room('Parking', 'utility', 4, 6, 8.5, 12) // 102 sq ft for one 135 sq ft car
    const { fix, after } = fixFirst(plot(), [floor([parking, room('Living Room', 'living', 4, 18, 14, 12)])], 'req-parking', brief({ parkingCars: 1 }))

    const grown = rooms(fix!.floors).find((r) => r.id === parking.id)!
    expect(grown.width * grown.height).toBeGreaterThanOrEqual(135)
    expect(failing(after, 'req-parking')).toEqual([])
  })

  it('offers nothing when the room is boxed in', () => {
    const small = room('Bedroom', 'bedroom', 2.75, 3.75, 7, 9)
    const floors = [
      floor([small, room('Living Room', 'living', 9.75, 3.75, 17.5, 9), room('Kitchen', 'kitchen', 2.75, 12.75, 24.5, 24.5)]),
    ]
    const result = check(plot(), floors).results.find((r) => r.id === `space-min-${small.id}`)
    expect(planFix(result!.fix!, plot(), floors)).toBeNull()
  })
})
