import { describe, expect, it } from 'vitest'
import type { Floor, OpeningEdit, Plot, Room, RoomType } from '@/types/design'
import { MAIN_DOOR_KEY, buildFloorModel, doorKey, isDoor, wallLength } from './geometry'

const plot: Plot = { width: 30, height: 40, facing: 'north', units: 'ft', setbacks: { front: 3, rear: 2, left: 2, right: 2 } }
const room = (id: string, type: RoomType, x: number, y: number, width: number, height: number): Room => ({
  id, name: id, type, x, y, width, height, rotation: 0, wallHeight: 9, elevation: 0, color: null,
  floorFinish: 'tile', locked: false, visible: true, label: null, notes: '',
})
// A living room at the front (road to the north), a bedroom behind it and a bathroom beside the bedroom.
const rooms = [room('living', 'living', 4, 4, 22, 14), room('bed', 'bedroom', 4, 18, 14, 12), room('bath', 'wet', 18, 18, 8, 12)]
const floor = (edits?: Record<string, OpeningEdit>, roomList = rooms): Floor => ({
  id: 'g', name: 'Ground Floor', level: 0, elevation: 0, rooms: roomList, openingEdits: edits,
  wallOverrides: {}, openings: [], furniture: [], staircases: [], guides: { vertical: [], horizontal: [] },
})
const openingsOf = (f: Floor) => buildFloorModel(f, [f], plot).openings

describe('door and window edits', () => {
  const auto = openingsOf(floor())
  const door = auto.find((o) => o.key === doorKey('living', 'bed'))!
  const window = auto.find((o) => o.kind === 'window' && o.key.startsWith('window:living:N:'))!

  it('gives every opening a key that names its rooms, not its wall', () => {
    expect(door).toBeDefined()
    expect(doorKey('bed', 'living')).toBe(door.key)
    expect(auto.find((o) => o.kind === 'main-door')?.key).toBe(MAIN_DOOR_KEY)
    expect(window.key).toBe('window:living:N:0')
    // Moving a room keeps its keys, so saved changes stay with the same doors and windows.
    const moved = openingsOf(floor(undefined, rooms.map((r) => ({ ...r, x: r.x + 1 }))))
    expect(new Set(moved.map((o) => o.key))).toEqual(new Set(auto.map((o) => o.key)))
  })

  it('moves, widens and flips a door along its wall, keeping it inside the wall', () => {
    const edited = openingsOf(floor({ [door.key]: { at: 0.75, width: 3.5, flipSwing: true, flipHinge: true } }))
    const moved = edited.find((o) => o.key === door.key)!
    const length = wallLength(moved.wall)
    expect(moved.center).toBeCloseTo(moved.wall.from + 0.75 * length, 6)
    expect(moved.width).toBe(3.5)
    expect(moved.swingSide).not.toBe(door.swingSide)
    expect(moved.hingeAtStart).toBe(!door.hingeAtStart)
    const pushed = openingsOf(floor({ [door.key]: { at: 1 } })).find((o) => o.key === door.key)!
    expect(pushed.center + pushed.width / 2).toBeLessThanOrEqual(pushed.wall.to)
  })

  it('removes an opening, and other openings stay where the rules put them', () => {
    const edited = openingsOf(floor({ [window.key]: { removed: true } }))
    expect(edited.some((o) => o.key === window.key)).toBe(false)
    expect(edited.filter((o) => isDoor(o)).map((o) => [o.key, o.center])).toEqual(auto.filter((o) => isDoor(o)).map((o) => [o.key, o.center]))
  })

  it('changes nothing without edits', () => {
    expect(openingsOf(floor({}))).toEqual(auto)
  })
})
