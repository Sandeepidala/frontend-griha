import { describe, expect, it } from 'vitest'
import type { Floor, Plot, Room, RoomType } from '@/types/design'
import { PARAPET_HEIGHT, PLINTH_HEIGHT, buildBuildingModel } from './geometry'
import { MASSING_COLORS, buildingBoxes } from './massing'

const plot: Plot = { width: 30, height: 40, facing: 'north', units: 'ft', setbacks: { front: 5, rear: 3, left: 3, right: 3 } }
let n = 0
const room = (name: string, type: RoomType, x: number, y: number, width: number, height: number): Room => ({
  id: `r${++n}`, name, type, x, y, width, height, rotation: 0, wallHeight: 9, elevation: 0, color: null,
  floorFinish: 'tile', locked: false, visible: true, label: null, notes: '',
})
const floor = (rooms: Room[], level: number): Floor => ({
  id: `f${level}`, name: level ? 'First Floor' : 'Ground Floor', level, elevation: level * 10, rooms,
  wallOverrides: {}, openings: [], furniture: [], staircases: [], guides: { vertical: [], horizontal: [] },
})

describe('buildingBoxes', () => {
  it('stacks the plinth and every floor from the ground up, with windows as glass', () => {
    const models = buildBuildingModel(
      [floor([room('Living Room', 'living', 4, 6, 12, 14), room('Kitchen', 'kitchen', 16, 6, 10, 14)], 0), floor([room('Bedroom', 'bedroom', 4, 6, 22, 14)], 1)],
      plot,
    )
    const boxes = buildingBoxes(models)
    const plinth = boxes[0]
    expect([plinth.z0, plinth.z1, plinth.color]).toEqual([0, PLINTH_HEIGHT, MASSING_COLORS.plinth])
    // The top floor's parapet is the highest thing: plinth + first floor level + storey + parapet (+ coping).
    const top = Math.max(...boxes.map((b) => b.z1))
    const upper = models[1]
    expect(top).toBeCloseTo(PLINTH_HEIGHT + upper.floor.elevation + upper.height + PARAPET_HEIGHT + 0.25, 5)
    // Nothing sits below the ground.
    expect(Math.min(...boxes.map((b) => b.z0))).toBe(0)
    expect(boxes.some((b) => b.color === MASSING_COLORS.glass && b.opacity)).toBe(true)
  })
})
