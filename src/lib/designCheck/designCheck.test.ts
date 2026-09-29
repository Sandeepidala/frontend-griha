import { describe, expect, it } from 'vitest'
import { DEFAULT_BRIEF } from '@/lib/brief'
import type { ProjectBrief } from '@/types/brief'
import type { Floor, Plot, Room, RoomType } from '@/types/design'
import { runDesignCheck, type CheckCategory, type DesignReport } from '.'

let nextId = 0

function room(name: string, type: RoomType, x: number, y: number, width: number, height: number): Room {
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

/** A 40 × 40 ft north-facing plot with no setbacks unless a test sets them. */
function plot(overrides: Partial<Plot> = {}): Plot {
  return { width: 40, height: 40, facing: 'north', units: 'ft', setbacks: { front: 0, rear: 0, left: 0, right: 0 }, ...overrides }
}

function brief(overrides: Partial<ProjectBrief> = {}): ProjectBrief {
  return { ...DEFAULT_BRIEF, parkingCars: 0, bedrooms: 1, bathrooms: 1, vastu: false, ...overrides }
}

function results(report: DesignReport, category: CheckCategory) {
  return report.categories.find((c) => c.category === category)?.results ?? []
}

function find(report: DesignReport, id: string) {
  return report.results.find((r) => r.id === id || r.id.startsWith(id))
}

/**
 * A sound ground floor on a 40 × 40 north-facing plot, set back 4 ft all round: living room and foyer
 * at the front (north), bathroom in the west, master bedroom in the south-west, a store in the south and the
 * kitchen in the south-east, around an open courtyard. Every room has an outside wall.
 */
function soundHouse() {
  const living = room('Living Room', 'living', 4, 4, 18, 10)
  const foyer = room('Foyer', 'circulation', 22, 4, 14, 10)
  const bath = room('Bathroom', 'wet', 4, 14, 8, 10)
  const master = room('Master Bedroom', 'bedroom', 4, 24, 12, 12)
  const store = room('Store Room', 'utility', 16, 24, 6, 12)
  const kitchen = room('Kitchen', 'kitchen', 26, 24, 10, 12)
  return { living, master, bath, store, kitchen, floors: [floor([living, foyer, bath, master, store, kitchen])] }
}

describe('runDesignCheck', () => {
  it('reports nothing to check for an empty plan', () => {
    const report = runDesignCheck({ plot: plot(), floors: [floor([])], brief: brief() })
    expect(report.categories).toEqual([])
    expect(report.skipped.map((s) => s.category)).toContain('site')
  })

  it('skips brief match and Vastu without a brief, and Vastu when the brief turns it off', () => {
    const { floors } = soundHouse()
    const noBrief = runDesignCheck({ plot: plot(), floors, brief: null })
    expect(noBrief.skipped.map((s) => s.category).sort()).toEqual(['budget', 'requirements', 'vastu'])
    const vastuOff = runDesignCheck({ plot: plot(), floors, brief: brief({ vastu: false }) })
    expect(vastuOff.skipped).toContainEqual({ category: 'vastu', reason: 'Vastu is turned off in the brief.' })
    expect(results(vastuOff, 'vastu')).toEqual([])
  })

  it('scores a plan that meets everything at 100', () => {
    const { floors } = soundHouse()
    const report = runDesignCheck({ plot: plot(), floors, brief: brief() })
    const problems = report.results.filter((r) => r.status !== 'pass')
    expect(problems).toEqual([])
    expect(report.score).toBe(100)
  })
})

describe('brief match', () => {
  it('fails when the plan has fewer bedrooms or bathrooms than briefed', () => {
    const { floors } = soundHouse()
    const report = runDesignCheck({ plot: plot(), floors, brief: brief({ bedrooms: 3, bathrooms: 2 }) })
    expect(find(report, 'req-bedrooms')).toMatchObject({ status: 'fail', title: 'Bedrooms: only 1 of 3' })
    expect(find(report, 'req-bathrooms')).toMatchObject({ status: 'fail', title: 'Bathrooms: only 1 of 2' })
  })

  it('checks floors, the ground-floor bedroom and parking size', () => {
    const { living, bath, kitchen } = soundHouse()
    const upstairs = floor([room('Bedroom 2', 'bedroom', 0, 16, 16, 24)], 1)
    const ground = floor([living, bath, kitchen, room('Parking', 'utility', 13, 14, 8, 12)])
    const report = runDesignCheck({
      plot: plot(),
      floors: [ground, upstairs],
      brief: brief({ floors: 1, parkingCars: 1, needsGroundFloorBedroom: true }),
    })
    expect(find(report, 'req-floors')?.status).toBe('warn') // 2 floors drawn, 1 briefed
    expect(find(report, 'req-ground-bedroom')?.status).toBe('fail')
    expect(find(report, 'req-parking')).toMatchObject({ status: 'warn', title: expect.stringContaining('96 sq ft') })
  })

  it('recognises extra rooms by type or by name', () => {
    const { floors } = soundHouse()
    floors[0].rooms.push(room('Pooja', 'pooja', 0, 0, 5, 5), room('Study / Office', 'utility', 5, 0, 8, 8))
    const report = runDesignCheck({
      plot: plot({ width: 60 }),
      floors,
      brief: brief({ extraRooms: ['quiet_room', 'home_office', 'guest_room'] }),
    })
    expect(find(report, 'req-extra-quiet_room')?.status).toBe('pass')
    expect(find(report, 'req-extra-home_office')?.status).toBe('pass')
    expect(find(report, 'req-extra-guest_room')?.status).toBe('warn')
  })

  it('wants an open kitchen to share a wall with the living room', () => {
    const joined = [floor([room('Living Room', 'living', 0, 0, 24, 16), room('Kitchen', 'kitchen', 24, 0, 16, 16)])]
    expect(find(runDesignCheck({ plot: plot(), floors: joined, brief: brief({ kitchenType: 'open' }) }), 'req-kitchen')?.status).toBe('pass')
    const apart = [floor([room('Living Room', 'living', 0, 0, 16, 16), room('Kitchen', 'kitchen', 24, 24, 16, 16)])]
    expect(find(runDesignCheck({ plot: plot(), floors: apart, brief: brief({ kitchenType: 'open' }) }), 'req-kitchen')?.status).toBe('warn')
  })
})

describe('room sizes', () => {
  it('fails a bedroom below the NBC minimum and only warns for a small bathroom', () => {
    const { living, master, kitchen } = soundHouse()
    const tinyBedroom = room('Bedroom 2', 'bedroom', 13, 14, 6, 10) // 60 sq ft, 6 ft wide, in the courtyard
    const tinyBath = room('WC', 'wet', 20, 14, 2, 5)
    const report = runDesignCheck({ plot: plot(), floors: [floor([living, master, kitchen, tinyBedroom, tinyBath])], brief: brief() })
    expect(find(report, `space-min-${tinyBedroom.id}`)).toMatchObject({ status: 'fail', roomIds: [tinyBedroom.id] })
    expect(find(report, `space-min-${tinyBath.id}`)?.status).toBe('warn')
  })

  it('flags overlapping rooms but not rooms that only touch', () => {
    const a = room('Bedroom 1', 'bedroom', 0, 0, 12, 12)
    const touching = room('Bedroom 2', 'bedroom', 12, 0, 12, 12)
    const overlapping = room('Bedroom 3', 'bedroom', 20, 6, 12, 12)
    const report = runDesignCheck({ plot: plot(), floors: [floor([a, touching, overlapping])], brief: brief() })
    const overlaps = results(report, 'space').filter((r) => r.id.startsWith('space-overlap'))
    expect(overlaps).toHaveLength(1)
    expect(overlaps[0].roomIds?.sort()).toEqual([touching.id, overlapping.id].sort())
  })
})

describe('proportional scoring', () => {
  const score = (report: DesignReport, category: CheckCategory) => report.categories.find((c) => c.category === category)?.score

  it('lets one small room lower Room sizes in proportion, not to zero', () => {
    const { floors } = soundHouse() // 4 main rooms that meet the minimums (the store isn't sized)
    const small = room('Bedroom 2', 'bedroom', 13, 14, 6, 10)
    floors[0].rooms.push(small)
    const report = runDesignCheck({ plot: plot(), floors, brief: brief() })
    expect(find(report, 'space-min-passed')).toMatchObject({ title: '4 of 5 main rooms meet the minimum sizes', weight: 4 })
    expect(score(report, 'space')).toBe(80)
  })

  it('scores an enclosed room against the rooms that do have an outside wall', () => {
    const rooms: Room[] = []
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) rooms.push(room(`Bedroom ${row}${col}`, 'bedroom', col * 12, row * 12, 12, 12))
    }
    const report = runDesignCheck({ plot: plot(), floors: [floor(rooms)], brief: brief() })
    expect(find(report, 'light-outside-passed')?.title).toBe('8 of 9 bedrooms, living rooms and kitchens have an outside wall')
    expect(score(report, 'light')).toBeGreaterThan(70)
  })
})

describe('light and ventilation', () => {
  it('fails a habitable room enclosed on all sides', () => {
    // A 3 × 3 grid of rooms: the middle one has no outside wall.
    const rooms: Room[] = []
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        rooms.push(room(row === 1 && col === 1 ? 'Inner Bedroom' : `Room ${row}${col}`, row === 1 && col === 1 ? 'bedroom' : 'utility', col * 12, row * 12, 12, 12))
      }
    }
    const inner = rooms[4]
    const report = runDesignCheck({ plot: plot(), floors: [floor(rooms)], brief: brief() })
    expect(find(report, `light-none-${inner.id}`)).toMatchObject({ status: 'fail', roomIds: [inner.id] })
  })

  it('credits corner rooms with cross-ventilation', () => {
    const { floors } = soundHouse() // every room touches two or more outside walls
    const report = runDesignCheck({ plot: plot(), floors, brief: brief() })
    expect(find(report, 'light-cross-share')).toMatchObject({ status: 'pass', title: '3 of 3 bedrooms, living rooms and kitchens have windows on two sides' })
  })
})

describe('privacy', () => {
  it('warns about a family bedroom at the road side, but not a guest room', () => {
    const bedroom = room('Bedroom 1', 'bedroom', 0, 0, 14, 12) // north edge of a north-facing plot
    const guest = room('Guest Room', 'bedroom', 14, 0, 14, 12)
    const report = runDesignCheck({ plot: plot(), floors: [floor([bedroom, guest, room('Living', 'living', 0, 12, 28, 28)])], brief: brief() })
    const warnings = results(report, 'privacy').filter((r) => r.id.startsWith('privacy-front-'))
    expect(warnings.map((r) => r.roomIds)).toEqual([[bedroom.id]])
  })

  it('reads "road side" from the plot facing', () => {
    const bedroom = room('Bedroom 1', 'bedroom', 28, 0, 12, 40) // east edge
    const report = runDesignCheck({ plot: plot({ facing: 'east' }), floors: [floor([bedroom])], brief: brief() })
    expect(find(report, `privacy-front-${bedroom.id}`)?.status).toBe('warn')
  })

  it('warns when a bathroom shares a wall with the kitchen, and about bathrooms in a joint family', () => {
    const kitchen = room('Kitchen', 'kitchen', 0, 0, 12, 12)
    const bath = room('Bathroom', 'wet', 12, 0, 8, 12)
    const bedrooms = [room('Bedroom 1', 'bedroom', 0, 20, 12, 12), room('Bedroom 2', 'bedroom', 12, 20, 12, 12)]
    const report = runDesignCheck({ plot: plot(), floors: [floor([kitchen, bath, ...bedrooms])], brief: brief({ familyType: 'joint' }) })
    expect(find(report, 'privacy-bath-kitchen-')?.roomIds?.sort()).toEqual([bath.id, kitchen.id].sort())
    expect(find(report, 'privacy-joint-baths')).toMatchObject({ status: 'warn', title: '1 bathrooms for 2 bedrooms in a joint family' })
  })
})

describe('Vastu', () => {
  it('passes the sound house and prefers a south-east kitchen', () => {
    const { floors, kitchen, master } = soundHouse()
    const report = runDesignCheck({ plot: plot(), floors, brief: brief({ vastu: true }) })
    expect(find(report, `vastu-${kitchen.id}`)?.title).toBe('Kitchen in the south-east (ideal)')
    expect(find(report, `vastu-${master.id}`)?.title).toBe('Master Bedroom in the south-west (ideal)')
  })

  it('fails a kitchen in the north-east and a bathroom at the centre', () => {
    const kitchen = room('Kitchen', 'kitchen', 28, 0, 12, 12)
    const bath = room('Bathroom', 'wet', 16, 16, 8, 8)
    const store = room('Store', 'utility', 0, 28, 12, 12) // spans the house across the plot
    const report = runDesignCheck({ plot: plot(), floors: [floor([kitchen, bath, store])], brief: brief({ vastu: true }) })
    expect(find(report, `vastu-${kitchen.id}`)).toMatchObject({ status: 'fail', detail: expect.stringContaining('Ideal: south-east') })
    expect(find(report, `vastu-${bath.id}`)?.status).toBe('fail')
  })

  it('judges zones on the house, not the whole plot', () => {
    // A small house in the south-west corner of a big plot: its own kitchen corner is south-east.
    const kitchen = room('Kitchen', 'kitchen', 12, 72, 8, 8)
    const house = [room('Living', 'living', 0, 60, 20, 12), room('Bedroom', 'bedroom', 0, 72, 12, 8), kitchen]
    const report = runDesignCheck({ plot: plot({ width: 80, height: 80 }), floors: [floor(house)], brief: brief({ vastu: true }) })
    expect(find(report, `vastu-${kitchen.id}`)?.title).toBe('Kitchen in the south-east (ideal)')
  })

  it('checks which half of the road side the main entrance is on', () => {
    // North-facing: the foyer's north wall carries the main door.
    const eastFoyer = [room('Foyer', 'circulation', 24, 0, 16, 10), room('Living', 'living', 0, 0, 24, 20)]
    const westFoyer = [room('Foyer', 'circulation', 0, 0, 16, 10), room('Living', 'living', 16, 0, 24, 20)]
    const good = runDesignCheck({ plot: plot(), floors: [floor(eastFoyer)], brief: brief({ vastu: true }) })
    const poor = runDesignCheck({ plot: plot(), floors: [floor(westFoyer)], brief: brief({ vastu: true }) })
    expect(find(good, 'vastu-entrance')?.status).toBe('pass')
    expect(find(poor, 'vastu-entrance')?.status).toBe('warn')
  })
})

describe('budget', () => {
  const check = (estimate: number, budget: number) =>
    find(runDesignCheck({ plot: plot(), floors: soundHouse().floors, brief: brief(), cost: { estimate, budget, turnkey: false } }), 'budget-total')

  it('passes within budget, suggests up to 10% over, and fails beyond', () => {
    expect(check(40e5, 45e5)).toMatchObject({ status: 'pass', title: 'Estimate ₹40.0 L is within the ₹45.0 L construction-only budget' })
    expect(check(48e5, 45e5)).toMatchObject({ status: 'warn', title: 'Estimate ₹48.0 L is 7% over the ₹45.0 L construction-only budget' })
    expect(check(60e5, 45e5)?.status).toBe('fail')
  })

  it('is skipped without a budget', () => {
    const report = runDesignCheck({ plot: plot(), floors: soundHouse().floors, brief: brief(), cost: { estimate: 40e5, budget: 0, turnkey: false } })
    expect(report.skipped.map((s) => s.category)).toContain('budget')
  })
})

describe('site and setbacks', () => {
  it('fails each side that intrudes into its setback, named by the plot facing', () => {
    // East-facing: front = east, rear = west, left = north, right = south.
    const house = room('Living', 'living', 5, 5, 30, 34) // ~4.25 ft clear west/north, ~0.25 ft south
    const report = runDesignCheck({
      plot: plot({ facing: 'east', setbacks: { front: 3, rear: 3, left: 3, right: 3 } }),
      floors: [floor([house])],
      brief: brief(),
    })
    const failed = results(report, 'site').filter((r) => r.status === 'fail').map((r) => r.id)
    expect(failed).toEqual(['site-setback-right'])
  })

  it('warns about ground coverage above 75%', () => {
    const report = runDesignCheck({ plot: plot(), floors: [floor([room('Living', 'living', 0, 0, 40, 40)])], brief: brief() })
    expect(find(report, 'site-coverage')).toMatchObject({ status: 'warn', title: 'Ground coverage 100% of the plot' })
  })
})
