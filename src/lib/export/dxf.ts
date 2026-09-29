import {
  type FloorModel,
  type PlanOpening,
  type Point,
  type Rect,
  OUTWARD,
  SETBACK_SIDES,
  area,
  formatFeet,
  formatLevel,
  wallCenterOffset,
  wallRect,
} from '@/lib/drawings/geometry'
import type { DrawingSet } from '@/lib/drawings/sheets'

/**
 * DXF export of the floor plans for CAD (project document §7, §9.2): every floor side by side in
 * one drawing, on standard layers, with walls, doors, windows, room labels, dimensions, the plot
 * and its setback line. Written as AutoCAD R12 ASCII DXF, which AutoCAD, BricsCAD, DraftSight,
 * LibreCAD and QCAD all open.
 *
 * Plans are drawn in inches (AutoCAD's architectural feet-inch units) for feet projects and in
 * millimetres for metre projects. Plan space is north-up with y running south; DXF y runs north.
 */

export type DxfUnits = 'in' | 'mm'

const UNIT_SCALE: Record<DxfUnits, number> = { in: 12, mm: 304.8 }

interface Layer {
  name: string
  /** AutoCAD colour index. */
  color: number
  linetype?: 'CONTINUOUS' | 'DASHED' | 'CENTER'
}

export const DXF_LAYERS = {
  plot: { name: 'A-SITE-PLOT', color: 6 },
  setback: { name: 'A-SITE-SETB', color: 1, linetype: 'DASHED' },
  wall: { name: 'A-WALL', color: 7 },
  wallFill: { name: 'A-WALL-PATT', color: 8 },
  door: { name: 'A-DOOR', color: 30 },
  glazing: { name: 'A-GLAZ', color: 4 },
  furniture: { name: 'A-FURN', color: 8 },
  roomName: { name: 'A-AREA-IDEN', color: 7 },
  dims: { name: 'A-ANNO-DIMS', color: 3 },
  title: { name: 'A-ANNO-TTLB', color: 7 },
} as const satisfies Record<string, Layer>

type LayerKey = keyof typeof DXF_LAYERS

/** Gap between floors laid out side by side, feet. */
const FLOOR_GAP = 20

/** DXF text is plain ASCII here; swap the typographic characters the plans use. */
function ascii(text: string) {
  return text
    .replace(/[×]/g, 'x')
    .replace(/[·•]/g, '-')
    .replace(/[—–−]/g, '-')
    .replace(/[½]/g, '1/2')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e]/g, '')
}

/** Accumulates DXF group-code pairs. */
class DxfWriter {
  private out: string[] = []
  pair(code: number, value: string | number) {
    this.out.push(String(code), typeof value === 'number' ? fmt(value) : value)
  }
  toString() {
    return `${this.out.join('\n')}\n`
  }
}

function fmt(n: number) {
  const v = Math.round(n * 1e4) / 1e4
  return Object.is(v, -0) ? '0' : String(v)
}

/** Plan feet → DXF drawing units, with the floor's offset along x. */
interface Frame {
  toDxf: (p: Point) => Point
  /** Feet → drawing units, for lengths such as text heights. */
  len: (feet: number) => number
}

class Entities {
  private w: DxfWriter
  private frame: Frame
  constructor(w: DxfWriter, frame: Frame) {
    this.w = w
    this.frame = frame
  }

  private head(type: string, layer: LayerKey) {
    this.w.pair(0, type)
    this.w.pair(8, DXF_LAYERS[layer].name)
  }

  line(layer: LayerKey, a: Point, b: Point) {
    const p = this.frame.toDxf(a)
    const q = this.frame.toDxf(b)
    this.head('LINE', layer)
    this.w.pair(10, p.x)
    this.w.pair(20, p.y)
    this.w.pair(30, 0)
    this.w.pair(11, q.x)
    this.w.pair(21, q.y)
    this.w.pair(31, 0)
  }

  polyline(layer: LayerKey, points: Point[], closed: boolean) {
    this.head('POLYLINE', layer)
    this.w.pair(66, 1)
    this.w.pair(10, 0)
    this.w.pair(20, 0)
    this.w.pair(30, 0)
    this.w.pair(70, closed ? 1 : 0)
    for (const point of points) {
      const p = this.frame.toDxf(point)
      this.head('VERTEX', layer)
      this.w.pair(10, p.x)
      this.w.pair(20, p.y)
      this.w.pair(30, 0)
    }
    this.head('SEQEND', layer)
  }

  rect(layer: LayerKey, r: Rect) {
    this.polyline(layer, corners(r), true)
  }

  /** A filled rectangle (R12 SOLID: corners in Z order). */
  solid(layer: LayerKey, r: Rect) {
    const [a, b, c, d] = corners(r).map(this.frame.toDxf)
    this.head('SOLID', layer)
    const order = [a, b, d, c]
    order.forEach((p, i) => {
      this.w.pair(10 + i, p.x)
      this.w.pair(20 + i, p.y)
      this.w.pair(30 + i, 0)
    })
  }

  /** Arc about `center` from `from` sweeping 90° to `to`, either way round. */
  quarterArc(layer: LayerKey, center: Point, from: Point, to: Point) {
    const c = this.frame.toDxf(center)
    const a = this.frame.toDxf(from)
    const b = this.frame.toDxf(to)
    const angle = (p: Point) => (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI
    let start = angle(a)
    let end = angle(b)
    // DXF arcs run counter-clockwise from start to end.
    if ((((end - start) % 360) + 360) % 360 > 180) [start, end] = [end, start]
    this.head('ARC', layer)
    this.w.pair(10, c.x)
    this.w.pair(20, c.y)
    this.w.pair(30, 0)
    this.w.pair(40, Math.hypot(a.x - c.x, a.y - c.y))
    this.w.pair(50, (start + 360) % 360)
    this.w.pair(51, (end + 360) % 360)
  }

  /** Text centred on `at` (feet); `height` in feet; `rotation` in degrees, counter-clockwise. */
  text(layer: LayerKey, at: Point, value: string, height: number, options: { rotation?: number; align?: 'left' | 'center' } = {}) {
    const clean = ascii(value)
    if (!clean.trim()) return
    const p = this.frame.toDxf(at)
    this.head('TEXT', layer)
    this.w.pair(10, p.x)
    this.w.pair(20, p.y)
    this.w.pair(30, 0)
    this.w.pair(40, this.frame.len(height))
    this.w.pair(1, clean)
    if (options.rotation) this.w.pair(50, options.rotation)
    if (options.align !== 'left') {
      // Middle-centre justification, anchored at the second alignment point.
      this.w.pair(72, 1)
      this.w.pair(11, p.x)
      this.w.pair(21, p.y)
      this.w.pair(31, 0)
      this.w.pair(73, 2)
    }
  }
}

function corners(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ]
}

/** A wall's solid pieces with the door and window openings cut out. */
export function wallPieces(model: FloorModel): Rect[] {
  const pieces: Rect[] = []
  for (const wall of model.walls) {
    const r = wallRect(wall)
    const horizontal = wall.orientation === 'h'
    const start = horizontal ? r.x : r.y
    const end = start + (horizontal ? r.width : r.height)
    const gaps = model.openings
      .filter((o) => o.wall.id === wall.id)
      .map((o) => [o.center - o.width / 2, o.center + o.width / 2] as const)
      .sort((a, b) => a[0] - b[0])
    let cursor = start
    const spans: [number, number][] = []
    for (const [g0, g1] of gaps) {
      if (g0 > cursor) spans.push([cursor, Math.min(g0, end)])
      cursor = Math.max(cursor, g1)
    }
    if (cursor < end) spans.push([cursor, end])
    for (const [a, b] of spans) {
      if (b - a < 0.01) continue
      pieces.push(horizontal ? { x: a, y: r.y, width: b - a, height: r.height } : { x: r.x, y: a, width: r.width, height: b - a })
    }
  }
  return pieces
}

function drawOpening(e: Entities, o: PlanOpening) {
  const horizontal = o.wall.orientation === 'h'
  const t = o.wall.thickness
  const c = o.wall.at + wallCenterOffset(o.wall)
  const a0 = o.center - o.width / 2
  const a1 = o.center + o.width / 2
  const P = (along: number, across: number): Point => (horizontal ? { x: along, y: across } : { x: across, y: along })

  if (o.kind === 'door' || o.kind === 'main-door') {
    const dir = OUTWARD[o.swingSide ?? 'S']
    const s = horizontal ? dir.y : dir.x
    const face = c + (s * t) / 2
    const hinge = o.hingeAtStart ? a0 : a1
    const shut = o.hingeAtStart ? a1 : a0
    e.line('door', P(hinge, face), P(hinge, face + s * o.width))
    e.quarterArc('door', P(hinge, face), P(shut, face), P(hinge, face + s * o.width))
    for (const a of [a0, a1]) e.line('door', P(a, c - t / 2), P(a, c + t / 2))
    return
  }
  const lines = o.kind === 'ventilator' ? [c - t / 4, c + t / 4] : [c - t / 2, c, c + t / 2]
  for (const across of lines) e.line('glazing', P(a0, across), P(a1, across))
  for (const a of [a0, a1]) e.line('glazing', P(a, c - t / 2), P(a, c + t / 2))
}

/** A dimension chain: extension ticks at each stop and the length of each segment. */
function dimChain(e: Entities, axis: 'x' | 'y', stops: number[], at: number, textSize: number) {
  const sorted = [...new Set(stops.map((s) => Math.round(s * 100) / 100))].sort((a, b) => a - b)
  if (sorted.length < 2) return
  const P = (along: number, across: number): Point => (axis === 'x' ? { x: along, y: across } : { x: across, y: along })
  const tick = textSize * 0.6
  e.line('dims', P(sorted[0], at), P(sorted[sorted.length - 1], at))
  for (const s of sorted) {
    e.line('dims', P(s, at - tick * 1.4), P(s, at + tick * 1.4))
    const c = P(s, at)
    // Architectural tick: a short 45° stroke.
    e.line('dims', { x: c.x - tick / 2, y: c.y + tick / 2 }, { x: c.x + tick / 2, y: c.y - tick / 2 })
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    const label = formatFeet(b - a)
    if (b - a < label.length * textSize * 0.75) continue
    e.text('dims', P((a + b) / 2, at - textSize * 0.9), label, textSize, { rotation: axis === 'y' ? 90 : 0 })
  }
}

function drawFloor(e: Entities, set: DrawingSet, model: FloorModel, showNorth: boolean) {
  const { plot } = set
  e.rect('plot', { x: 0, y: 0, width: plot.width, height: plot.height })

  // Setback line, from the plot's front/rear/left/right setbacks.
  const sides = SETBACK_SIDES[plot.facing]
  const by = { N: 0, S: 0, E: 0, W: 0 }
  for (const key of ['front', 'rear', 'left', 'right'] as const) by[sides[key]] = plot.setbacks[key]
  const inner = { x: by.W, y: by.N, width: plot.width - by.W - by.E, height: plot.height - by.N - by.S }
  if ((by.N || by.S || by.E || by.W) && inner.width > 0 && inner.height > 0) e.rect('setback', inner)

  for (const piece of wallPieces(model)) {
    e.solid('wallFill', piece)
    e.rect('wall', piece)
  }
  for (const o of model.openings) drawOpening(e, o)
  for (const item of set.items.get(model.floor.id) ?? []) e.rect('furniture', item)

  for (const room of model.rooms) {
    // Sized to fit the room: a character is up to about 0.85 of the text height wide in capitals.
    const fit = (text: string, max: number, perChar: number) => Math.min(max, (room.width * 0.85) / (text.length * perChar), room.height / 3)
    const name = room.name.toUpperCase()
    const detail = `${formatFeet(room.width)} x ${formatFeet(room.height)} (${Math.round(area(room))} sft)`
    const size = fit(name, 0.9, 0.85)
    const small = fit(detail, size * 0.65, 0.62)
    const cx = room.x + room.width / 2
    const cy = room.y + room.height / 2
    e.text('roomName', { x: cx, y: cy - small * 0.7 }, name, size)
    e.text('roomName', { x: cx, y: cy + size * 0.5 + small * 0.4 }, detail, small)
  }

  // Room dimensions along the north and west faces, then overall.
  const fp = model.footprint
  const dim = 0.5
  if (fp) {
    const north = model.rooms.filter((r) => Math.abs(r.y - (fp.y + 0.75)) < 0.1).flatMap((r) => [r.x, r.x + r.width])
    const west = model.rooms.filter((r) => Math.abs(r.x - (fp.x + 0.75)) < 0.1).flatMap((r) => [r.y, r.y + r.height])
    dimChain(e, 'x', north, fp.y - 2.5, dim)
    dimChain(e, 'x', [fp.x, fp.x + fp.width], fp.y - 4.5, dim)
    dimChain(e, 'y', west, fp.x - 2.5, dim)
    dimChain(e, 'y', [fp.y, fp.y + fp.height], fp.x - 4.5, dim)
  }
  dimChain(e, 'x', [0, plot.width], plot.height + 3, dim)
  dimChain(e, 'y', [0, plot.height], plot.width + 3, dim)

  // Title under the plot.
  e.text('title', { x: 0, y: plot.height + 7 }, `${model.floor.name.toUpperCase()} PLAN`, 1.2, { align: 'left' })
  e.text('title', { x: 0, y: plot.height + 9 }, `${set.projectName} - FFL ${formatLevel(model.floor.elevation)} - plot ${formatFeet(plot.width)} x ${formatFeet(plot.height)}, ${plot.facing}-facing`, 0.6, { align: 'left' })

  if (showNorth) {
    const n = { x: -6, y: 2 }
    e.polyline('title', [{ x: n.x, y: n.y - 1.6 }, { x: n.x + 0.8, y: n.y + 1.2 }, { x: n.x, y: n.y + 0.5 }, { x: n.x - 0.8, y: n.y + 1.2 }], true)
    e.text('title', { x: n.x, y: n.y - 2.6 }, 'N', 1)
  }
}

export interface DxfResult {
  content: string
  units: DxfUnits
  floors: number
}

/** The whole plan set as one DXF drawing: floors left to right, lowest first. */
export function buildDxf(set: DrawingSet, units: DxfUnits = set.plot.units === 'm' ? 'mm' : 'in'): DxfResult {
  const k = UNIT_SCALE[units]
  const { plot } = set
  const step = plot.width + FLOOR_GAP
  const models = set.models.filter((m) => m.rooms.length > 0)
  const w = new DxfWriter()
  const extMin = { x: -10 * k, y: -(plot.height + 12) * k }
  const extMax = { x: (Math.max(1, models.length) * step) * k, y: 6 * k }

  // Header: version, units and extents.
  w.pair(0, 'SECTION')
  w.pair(2, 'HEADER')
  const header: [string, number, string | number][] = [
    ['$ACADVER', 1, 'AC1009'],
    ['$DWGCODEPAGE', 3, 'ANSI_1252'],
    ['$INSUNITS', 70, units === 'in' ? 1 : 4],
    ['$LUNITS', 70, units === 'in' ? 4 : 2],
    ['$LUPREC', 70, units === 'in' ? 4 : 0],
    ['$MEASUREMENT', 70, units === 'in' ? 0 : 1],
    ['$LTSCALE', 40, units === 'in' ? 12 : 300],
  ]
  for (const [name, code, value] of header) {
    w.pair(9, name)
    w.pair(code, value)
  }
  w.pair(9, '$EXTMIN')
  w.pair(10, extMin.x)
  w.pair(20, extMin.y)
  w.pair(30, 0)
  w.pair(9, '$EXTMAX')
  w.pair(10, extMax.x)
  w.pair(20, extMax.y)
  w.pair(30, 0)
  w.pair(0, 'ENDSEC')

  // Tables: line types, layers, text style.
  w.pair(0, 'SECTION')
  w.pair(2, 'TABLES')
  const linetypes: [string, string, number[]][] = [
    ['CONTINUOUS', 'Solid line', []],
    ['DASHED', '__ __ __ __', [0.5, -0.25]],
    ['CENTER', '____ _ ____ _', [1.25, -0.25, 0.25, -0.25]],
  ]
  w.pair(0, 'TABLE')
  w.pair(2, 'LTYPE')
  w.pair(70, linetypes.length)
  for (const [name, description, pattern] of linetypes) {
    w.pair(0, 'LTYPE')
    w.pair(2, name)
    w.pair(70, 0)
    w.pair(3, description)
    w.pair(72, 65)
    w.pair(73, pattern.length)
    w.pair(40, pattern.reduce((s, v) => s + Math.abs(v), 0))
    for (const v of pattern) w.pair(49, v)
  }
  w.pair(0, 'ENDTAB')
  const layers = Object.values(DXF_LAYERS) as Layer[]
  w.pair(0, 'TABLE')
  w.pair(2, 'LAYER')
  w.pair(70, layers.length + 1)
  for (const layer of [{ name: '0', color: 7 }, ...layers] as Layer[]) {
    w.pair(0, 'LAYER')
    w.pair(2, layer.name)
    w.pair(70, 0)
    w.pair(62, layer.color)
    w.pair(6, layer.linetype ?? 'CONTINUOUS')
  }
  w.pair(0, 'ENDTAB')
  w.pair(0, 'TABLE')
  w.pair(2, 'STYLE')
  w.pair(70, 1)
  w.pair(0, 'STYLE')
  w.pair(2, 'STANDARD')
  w.pair(70, 0)
  w.pair(40, 0)
  w.pair(41, 1)
  w.pair(50, 0)
  w.pair(71, 0)
  w.pair(42, 2.5)
  w.pair(3, 'txt')
  w.pair(4, '')
  w.pair(0, 'ENDTAB')
  w.pair(0, 'ENDSEC')

  w.pair(0, 'SECTION')
  w.pair(2, 'BLOCKS')
  w.pair(0, 'ENDSEC')

  w.pair(0, 'SECTION')
  w.pair(2, 'ENTITIES')
  models.forEach((model, i) => {
    const offset = i * step
    const frame: Frame = {
      toDxf: (p) => ({ x: (p.x + offset) * k, y: -p.y * k }),
      len: (feet) => feet * k,
    }
    drawFloor(new Entities(w, frame), set, model, i === 0)
  })
  w.pair(0, 'ENDSEC')
  w.pair(0, 'EOF')

  return { content: w.toString(), units, floors: models.length }
}

export function dxfUnitsLabel(units: DxfUnits) {
  return units === 'in' ? 'inches (architectural feet-inches)' : 'millimetres'
}
