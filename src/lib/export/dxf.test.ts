import { describe, expect, it } from 'vitest'
import { wallRect } from '@/lib/drawings/geometry'
import { buildDrawingSet } from '@/lib/drawings/sheets'
import type { Floor, Plot, Room, RoomType } from '@/types/design'
import { DXF_LAYERS, buildDxf, wallPieces } from './dxf'

const plot = (overrides: Partial<Plot> = {}): Plot => ({
  width: 30,
  height: 40,
  facing: 'north',
  units: 'ft',
  setbacks: { front: 5, rear: 3, left: 3, right: 3 },
  ...overrides,
})

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
const house = () => [
  floor([room('Living Room', 'living', 4, 6, 12, 14), room('Kitchen', 'kitchen', 16, 6, 10, 14), room('Bedroom', 'bedroom', 4, 20, 22, 12)]),
  floor([room('Master Bedroom', 'bedroom', 4, 6, 22, 14)], 1),
]
const set = (p = plot(), floors = house()) => buildDrawingSet(p, floors, 'Sharma Residence × test', 'Griha')

/** DXF as [code, value] pairs. */
function pairs(content: string) {
  const lines = content.trimEnd().split('\n')
  const out: [number, string][] = []
  for (let i = 0; i < lines.length; i += 2) out.push([Number(lines[i]), lines[i + 1]])
  return out
}
const entities = (content: string, type: string) => pairs(content).filter(([c, v]) => c === 0 && v === type).length

describe('buildDxf', () => {
  it('writes a complete R12 drawing with every layer defined', () => {
    const { content, floors } = buildDxf(set())
    const p = pairs(content)
    expect(floors).toBe(2)
    expect(p.slice(0, 2)).toEqual([
      [0, 'SECTION'],
      [2, 'HEADER'],
    ])
    expect(p[p.length - 1]).toEqual([0, 'EOF'])
    expect(content).toContain('$ACADVER\n1\nAC1009')
    const layerNames = p.filter(([c], i) => c === 2 && p[i - 1]?.[1] === 'LAYER').map(([, v]) => v)
    expect(layerNames).toEqual(['0', ...Object.values(DXF_LAYERS).map((l) => l.name)])
    // Every entity is on a defined layer.
    const used = new Set(p.filter(([c], i) => c === 8 && p[i - 1]?.[0] === 0).map(([, v]) => v))
    for (const name of used) expect(layerNames).toContain(name)
    // Group codes are integers and values plain ASCII (the project name had a ×).
    expect(p.every(([c]) => Number.isInteger(c))).toBe(true)
    expect(/^[\x20-\x7e\n]*$/.test(content)).toBe(true)
  })

  it('draws feet plans in inches and metre plans in millimetres, north up', () => {
    const inches = buildDxf(set())
    expect(inches.units).toBe('in')
    expect(inches.content).toContain('$INSUNITS\n70\n1')
    const mm = buildDxf(set(plot({ units: 'm' })))
    expect(mm.units).toBe('mm')
    expect(mm.content).toContain('$INSUNITS\n70\n4')
    // The plot outline's far corner: 30 ft east, 40 ft south of the north-west corner.
    expect(inches.content).toContain('10\n360\n20\n-480')
    expect(mm.content).toContain('10\n9144\n20\n-12192')
  })

  it('cuts every door and window out of its wall, and draws a swing arc per door', () => {
    const drawing = set()
    const model = drawing.models[0]
    expect(model.openings.length).toBeGreaterThan(0)
    const pieces = wallPieces(model)
    for (const wall of model.walls) {
      const r = wallRect(wall)
      const length = wall.orientation === 'h' ? r.width : r.height
      const cut = model.openings.filter((o) => o.wall.id === wall.id).reduce((s, o) => s + o.width, 0)
      const kept = pieces
        .filter((p) => (wall.orientation === 'h' ? p.y === r.y && p.height === r.height && p.x >= r.x - 1e-6 && p.x + p.width <= r.x + r.width + 1e-6 : p.x === r.x && p.width === r.width && p.y >= r.y - 1e-6 && p.y + p.height <= r.y + r.height + 1e-6))
        .reduce((s, p) => s + (wall.orientation === 'h' ? p.width : p.height), 0)
      expect(kept).toBeCloseTo(length - cut, 5)
    }
    const doors = drawing.models.flatMap((m) => m.openings).filter((o) => o.kind === 'door' || o.kind === 'main-door').length
    expect(entities(buildDxf(drawing).content, 'ARC')).toBe(doors)
  })

  it('labels every room with its name and size, and titles each floor', () => {
    const { content } = buildDxf(set())
    expect(content).toContain('\nLIVING ROOM\n')
    expect(content).toContain(`\n12'-0" x 14'-0" (168 sft)\n`)
    expect(content).toContain('\nGROUND FLOOR PLAN\n')
    expect(content).toContain('\nFIRST FLOOR PLAN\n')
  })

  it('skips floors without rooms', () => {
    const { floors } = buildDxf(set(plot(), [...house(), floor([], 2)]))
    expect(floors).toBe(2)
  })
})
