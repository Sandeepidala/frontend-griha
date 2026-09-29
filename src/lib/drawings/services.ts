import type { Floor } from '@/types/design'
import {
  type FloorModel,
  type PlanRoom,
  type Point,
  type Rect,
  type Side,
  type WallSegment,
  EXTERIOR_WALL,
  OUTWARD,
  area,
  center,
  expand,
  isDoor,
  round2,
  sideOfWall,
  wallCenterOffset,
  wallLength,
} from './geometry'
import type { PlacedItem } from './interior'

/**
 * Engineering derivations for the structural, electrical and plumbing sheets. They are
 * rule-of-thumb preliminary designs meant for coordination drawings — every value is marked
 * "indicative" on the sheets and must be verified by the respective licensed engineer.
 */

const FT_TO_MM = 304.8

// ---------------------------------------------------------------------------------------------
// Structural
// ---------------------------------------------------------------------------------------------

export type ColumnKind = 'corner' | 'edge' | 'interior'

export interface Column {
  id: string
  label: string
  x: number
  y: number
  kind: ColumnKind
  width: number
  depth: number
}

const MAX_BEAM_SPAN = 14

function onWall(wall: WallSegment, p: Point, tol = 0.05) {
  const along = wall.orientation === 'h' ? p.x : p.y
  const across = wall.orientation === 'h' ? p.y : p.x
  return Math.abs(across - wall.at) < tol && along >= wall.from - tol && along <= wall.to + tol
}

/** Columns at every wall junction plus intermediates so no beam spans more than 14'. */
export function deriveColumns(walls: WallSegment[]): Column[] {
  const points: Point[] = []
  const add = (x: number, y: number) => {
    if (!points.some((p) => Math.hypot(p.x - x, p.y - y) < 2)) points.push({ x: round2(x), y: round2(y) })
  }
  for (const w of walls) {
    if (w.orientation === 'h') {
      add(w.from, w.at)
      add(w.to, w.at)
    } else {
      add(w.at, w.from)
      add(w.at, w.to)
    }
  }
  for (const w of walls) {
    const len = wallLength(w)
    const n = Math.ceil(len / MAX_BEAM_SPAN)
    for (let i = 1; i < n; i++) {
      const along = w.from + (len * i) / n
      if (w.orientation === 'h') add(along, w.at)
      else add(w.at, along)
    }
  }

  const columns = points.map((p) => {
    const exteriorWalls = walls.filter((w) => w.exterior && onWall(w, p))
    const hasH = exteriorWalls.some((w) => w.orientation === 'h')
    const hasV = exteriorWalls.some((w) => w.orientation === 'v')
    let x = p.x
    let y = p.y
    const shifted = new Set<Side>()
    for (const w of exteriorWalls) {
      if (!w.outside || shifted.has(w.outside)) continue
      shifted.add(w.outside)
      if (w.orientation === 'h') y += wallCenterOffset(w)
      else x += wallCenterOffset(w)
    }
    const kind: ColumnKind = hasH && hasV ? 'corner' : hasH || hasV ? 'edge' : 'interior'
    // 9" side sits within the wall thickness.
    const width = hasV && !hasH ? 0.75 : 1
    const depth = hasV && !hasH ? 1 : 0.75
    return { x, y, kind, width: kind === 'interior' ? 0.75 : width, depth: kind === 'interior' ? 1.25 : depth }
  })

  columns.sort((a, b) => a.y - b.y || a.x - b.x)
  return columns.map((c, i) => ({ ...c, id: `col-${i}`, label: `C${i + 1}` }))
}

export interface Footing {
  column: Column
  type: 'F1' | 'F2' | 'F3'
  size: number
  depthBelowGL: number
}

export const FOOTING_TYPES = {
  F1: { size: 4, thickness: '300 thk', steel: '12Ø @ 150 c/c both ways', for: 'Corner columns' },
  F2: { size: 5, thickness: '375 thk', steel: '12Ø @ 125 c/c both ways', for: 'Edge columns' },
  F3: { size: 6, thickness: '450 thk', steel: '16Ø @ 150 c/c both ways', for: 'Interior columns' },
} as const

export function deriveFootings(columns: Column[]): Footing[] {
  return columns.map((column) => {
    const type = column.kind === 'corner' ? 'F1' : column.kind === 'edge' ? 'F2' : 'F3'
    return { column, type, size: FOOTING_TYPES[type].size, depthBelowGL: 5 }
  })
}

export interface Beam {
  id: string
  label: string
  x1: number
  y1: number
  x2: number
  y2: number
  span: number
  widthMm: number
  depthMm: number
  exterior: boolean
}

export const BEAM_TYPES = [
  { label: 'B1', maxSpan: 10, widthMm: 230, depthMm: 300, top: '2-12Ø', bottom: '2-12Ø', stirrups: '8Ø @ 150 c/c' },
  { label: 'B2', maxSpan: 14, widthMm: 230, depthMm: 380, top: '2-12Ø', bottom: '3-12Ø', stirrups: '8Ø @ 150 c/c' },
  { label: 'B3', maxSpan: Infinity, widthMm: 230, depthMm: 450, top: '2-16Ø', bottom: '3-16Ø', stirrups: '8Ø @ 125 c/c' },
]

/** Beams run on every wall line, split at the columns that sit on it. */
export function deriveBeams(walls: WallSegment[], columns: Column[]): Beam[] {
  const beams: Beam[] = []
  for (const w of walls) {
    const across = w.at + wallCenterOffset(w)
    const stops = columns
      .filter((c) => {
        const cAcross = w.orientation === 'h' ? c.y : c.x
        const cAlong = w.orientation === 'h' ? c.x : c.y
        return Math.abs(cAcross - across) < 0.6 && cAlong >= w.from - 1 && cAlong <= w.to + 1
      })
      .map((c) => (w.orientation === 'h' ? c.x : c.y))
    const along = [...new Set([...stops, w.from, w.to].map(round2))].sort((a, b) => a - b)
    const pieces: [number, number][] = []
    for (let i = 0; i < along.length - 1; i++) if (along[i + 1] - along[i] > 0.9) pieces.push([along[i], along[i + 1]])
    for (const [a, b] of pieces) {
      const span = b - a
      const type = BEAM_TYPES.find((t) => span <= t.maxSpan)!
      beams.push({
        id: `beam-${w.id}-${a}`,
        label: type.label,
        ...(w.orientation === 'h' ? { x1: a, y1: across, x2: b, y2: across } : { x1: across, y1: a, x2: across, y2: b }),
        span,
        widthMm: type.widthMm,
        depthMm: type.depthMm,
        exterior: w.exterior,
      })
    }
  }
  return beams
}

export interface SlabPanel {
  room: PlanRoom
  label: string
  lx: number
  ly: number
  twoWay: boolean
  thicknessMm: number
  steel: string
}

export function deriveSlabs(rooms: PlanRoom[]): SlabPanel[] {
  return rooms.map((room, i) => {
    const lx = Math.min(room.width, room.height)
    const ly = Math.max(room.width, room.height)
    const twoWay = ly / lx <= 2
    const raw = (lx * FT_TO_MM) / (twoWay ? 32 : 26)
    const thicknessMm = Math.min(200, Math.max(125, Math.ceil(raw / 5) * 5))
    return {
      room,
      label: `S${i + 1}`,
      lx,
      ly,
      twoWay,
      thicknessMm,
      steel: twoWay ? '10Ø @ 150 c/c both ways (bottom), 8Ø @ 200 extra top at supports' : '10Ø @ 150 c/c main, 8Ø @ 200 c/c distribution',
    }
  })
}

export interface StairDesign {
  floorToFloor: number
  risers: number
  riserIn: number
  treadIn: number
  flights: [number, number]
  width: number
  landing: number
  going: number
  waistMm: number
  shape: string
}

/** A dog-leg stair sized to NBC limits (riser ≤ 7", tread ≥ 10"). */
export function designStair(floors: Floor[], lower: Floor, floorToFloor: number): StairDesign {
  const stored = floors.flatMap((f) => f.staircases).find((s) => s.floorId === lower.id)
  const risers = Math.ceil((floorToFloor * 12) / 7)
  const riserIn = (floorToFloor * 12) / risers
  const treadIn = 10
  const first = Math.ceil(risers / 2)
  const width = stored?.width && stored.width >= 3 ? stored.width : 3.5
  const going = ((first - 1) * treadIn) / 12
  return {
    floorToFloor,
    risers,
    riserIn,
    treadIn,
    flights: [first, risers - first],
    width,
    landing: width,
    going,
    waistMm: 150,
    shape: stored?.shape ?? 'dog-leg',
  }
}

// ---------------------------------------------------------------------------------------------
// Electrical
// ---------------------------------------------------------------------------------------------

export type ElecKind =
  | 'light'
  | 'fan'
  | 'exhaust'
  | 'switchboard'
  | 'socket5'
  | 'socket15'
  | 'ac'
  | 'geyser'
  | 'tv'
  | 'db'
  | 'bell'

export interface ElecPoint {
  id: string
  kind: ElecKind
  x: number
  y: number
  roomId: string
  circuit: string
  watts: number
}

export const ELEC_WATTS: Record<ElecKind, number> = {
  light: 20,
  fan: 75,
  exhaust: 40,
  switchboard: 0,
  socket5: 100,
  socket15: 1000,
  ac: 1500,
  geyser: 2000,
  tv: 150,
  db: 0,
  bell: 10,
}

export const ELEC_LABEL: Record<ElecKind, string> = {
  light: 'LED ceiling light point',
  fan: 'Ceiling fan point',
  exhaust: 'Exhaust fan point',
  switchboard: 'Modular switchboard (1200mm AFL)',
  socket5: '6A socket (300mm AFL)',
  socket15: '16A power socket',
  ac: 'AC point, 20A (2100mm AFL)',
  geyser: 'Geyser point, 16A (1800mm AFL)',
  tv: 'TV + data point',
  db: 'Distribution board (TPN)',
  bell: 'Call bell',
}

function inside(room: Rect, x: number, y: number, inset = 0.3): Point {
  return {
    x: Math.min(room.x + room.width - inset, Math.max(room.x + inset, x)),
    y: Math.min(room.y + room.height - inset, Math.max(room.y + inset, y)),
  }
}

/** A point on the room's inner wall face, `t` (0-1) of the way around its perimeter. */
function perimeterPoint(room: Rect, t: number, inset = 0.3): Point {
  const p = 2 * (room.width + room.height)
  let d = ((t % 1) + 1) % 1 * p
  if (d < room.width) return { x: room.x + d, y: room.y + inset }
  d -= room.width
  if (d < room.height) return { x: room.x + room.width - inset, y: room.y + d }
  d -= room.height
  if (d < room.width) return { x: room.x + room.width - d, y: room.y + room.height - inset }
  d -= room.width
  return { x: room.x + inset, y: room.y + room.height - d }
}

function nearDoor(model: FloorModel, room: PlanRoom, p: Point) {
  return model.openings.some((o) => {
    if (!isDoor(o) || !o.roomIds.includes(room.id)) return false
    const c = o.wall.orientation === 'h' ? { x: o.center, y: o.wall.at } : { x: o.wall.at, y: o.center }
    return Math.hypot(c.x - p.x, c.y - p.y) < o.width / 2 + 0.6
  })
}

function switchboardPoint(model: FloorModel, room: PlanRoom): Point {
  const door = model.openings.find((o) => isDoor(o) && o.roomIds.includes(room.id))
  if (!door) return inside(room, room.x, room.y, 0.3)
  const into = sideOfWall(door.wall, room)
  const offset = OUTWARD[into]
  // Latch side of the door, just inside the room.
  const along = door.center + door.width / 2 + 0.6
  const p = door.wall.orientation === 'h'
    ? { x: along, y: door.wall.at + offset.y * 0.3 }
    : { x: door.wall.at + offset.x * 0.3, y: along }
  return inside(room, p.x, p.y, 0.3)
}

export interface ElectricalPlan {
  points: ElecPoint[]
  switchboards: Map<string, Point>
  db: Point | null
  circuits: { id: string; description: string; points: number; watts: number; mcb: number; phase: string }[]
  connectedLoad: number
}

const MCB = [6, 10, 16, 20, 25, 32, 40]

export function electricalPlan(model: FloorModel, items: PlacedItem[]): ElectricalPlan {
  const points: ElecPoint[] = []
  const switchboards = new Map<string, Point>()
  const push = (kind: ElecKind, p: Point, room: PlanRoom) =>
    points.push({ id: `${room.id}-${kind}-${points.length}`, kind, x: p.x, y: p.y, roomId: room.id, circuit: '', watts: ELEC_WATTS[kind] })

  for (const room of model.rooms) {
    const roomArea = area(room)
    const c = center(room)
    const roomItems = items.filter((i) => i.roomId === room.id)

    // Lighting grid, roughly one point per 80 sq ft.
    const lights = Math.max(1, Math.round(roomArea / 80))
    const cols = Math.max(1, Math.round(Math.sqrt((lights * room.width) / room.height)))
    const rows = Math.max(1, Math.ceil(lights / cols))
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++)
        push('light', { x: room.x + (room.width * (i + 0.5)) / cols, y: room.y + (room.height * (j + 0.5)) / rows }, room)

    if (room.type === 'bedroom' || room.type === 'living') {
      // Offset from the light grid so fan and light symbols don't overlap.
      if (roomArea > 220) {
        for (const t of [0.25, 0.75]) {
          push('fan', room.width >= room.height ? { x: room.x + room.width * t, y: c.y + 0.8 } : { x: c.x + 0.8, y: room.y + room.height * t }, room)
        }
      } else {
        push('fan', { x: c.x + 0.8, y: c.y + 0.8 }, room)
      }
    }
    if (room.type === 'kitchen' || room.type === 'wet') {
      const exterior = model.walls.find((w) => w.exterior && w.roomIds.includes(room.id))
      const p = exterior
        ? inside(room, exterior.orientation === 'h' ? (exterior.from + exterior.to) / 2 + 1.5 : exterior.at, exterior.orientation === 'h' ? exterior.at : (exterior.from + exterior.to) / 2 + 1.5, 0.3)
        : inside(room, room.x + room.width, room.y, 0.3)
      push('exhaust', p, room)
    }

    const sb = switchboardPoint(model, room)
    switchboards.set(room.id, sb)
    push('switchboard', sb, room)

    // Sockets distributed around the perimeter, skipping door swings.
    const socketCount = { living: 4, bedroom: 3, kitchen: 2, pooja: 1, wet: 1, utility: 1, circulation: 1 }[room.type]
    let placed = 0
    for (let k = 0; k < 24 && placed < socketCount; k++) {
      const p = perimeterPoint(room, 0.08 + (k * 0.618) % 1)
      if (nearDoor(model, room, p)) continue
      push('socket5', p, room)
      placed++
    }

    for (const item of roomItems) {
      const ic = center(item)
      if (item.kind === 'side-table') push('socket5', ic, room)
      if (item.kind === 'tv-unit') push('tv', ic, room)
      if (item.kind === 'fridge') push('socket15', ic, room)
      if (item.kind === 'counter' && room.type === 'kitchen') {
        const along = item.width > item.height ? item.width : item.height
        const n = Math.max(1, Math.floor(along / 5))
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n
          push('socket15', item.width > item.height ? { x: item.x + item.width * t, y: ic.y } : { x: ic.x, y: item.y + item.height * t }, room)
        }
      }
      if (item.kind === 'shower') push('geyser', ic, room)
    }
    if (room.type === 'wet' && !roomItems.some((i) => i.kind === 'shower')) push('geyser', inside(room, room.x + room.width, room.y + room.height), room)

    if (room.type === 'bedroom' || (room.type === 'living' && roomArea >= 150)) {
      const exterior = model.walls.find((w) => w.exterior && w.roomIds.includes(room.id))
      const p = exterior
        ? inside(room, exterior.orientation === 'h' ? (exterior.from + exterior.to) / 2 - 2 : exterior.at, exterior.orientation === 'h' ? exterior.at : (exterior.from + exterior.to) / 2 - 2, 0.3)
        : perimeterPoint(room, 0.5)
      push('ac', p, room)
    }
  }

  let db: Point | null = null
  const main = model.openings.find((o) => o.kind === 'main-door')
  if (main) {
    const room = model.rooms.find((r) => main.roomIds.includes(r.id))!
    const into = OUTWARD[sideOfWall(main.wall, room)]
    const along = main.center - main.width / 2 - 1
    db = main.wall.orientation === 'h' ? inside(room, along, main.wall.at + into.y * 0.3) : inside(room, main.wall.at + into.x * 0.3, along)
    points.push({ id: 'db', kind: 'db', x: db.x, y: db.y, roomId: room.id, circuit: 'MAIN', watts: 0 })
    points.push({ id: 'bell', kind: 'bell', x: db.x, y: db.y + (into.y === 0 ? 1 : 0), roomId: room.id, circuit: '', watts: ELEC_WATTS.bell })
  } else {
    const stairRoom = model.rooms.find((r) => r.type === 'circulation') ?? model.rooms.find((r) => r.type === 'living') ?? model.rooms[0]
    if (stairRoom) {
      db = inside(stairRoom, stairRoom.x, stairRoom.y)
      points.push({ id: 'db', kind: 'db', x: db.x, y: db.y, roomId: stairRoom.id, circuit: 'MAIN', watts: 0 })
    }
  }

  // Circuit grouping per IS 732 practice: lighting ≤ 800 W, 6A power ≤ 6 points, heavy loads dedicated.
  const circuits: ElectricalPlan['circuits'] = []
  const mcbFor = (watts: number) => MCB.find((r) => r >= (watts / 230) * 1.25) ?? 40
  const group = (prefix: string, desc: string, kinds: ElecKind[], maxWatts: number, maxPoints: number) => {
    let current: ElecPoint[] = []
    let n = 1
    const flush = () => {
      if (!current.length) return
      const id = `${prefix}${n++}`
      const watts = current.reduce((s, p) => s + p.watts, 0)
      for (const p of current) p.circuit = id
      const rooms = [...new Set(current.map((p) => model.rooms.find((r) => r.id === p.roomId)?.name ?? ''))]
      circuits.push({ id, description: `${desc} — ${rooms.join(', ')}`, points: current.length, watts, mcb: mcbFor(watts), phase: '' })
      current = []
    }
    for (const room of model.rooms) {
      for (const p of points.filter((pt) => pt.roomId === room.id && kinds.includes(pt.kind))) {
        const load = current.reduce((s, q) => s + q.watts, 0)
        if (current.length >= maxPoints || load + p.watts > maxWatts) flush()
        current.push(p)
      }
    }
    flush()
  }
  group('L', 'Lighting & fans', ['light', 'fan', 'exhaust', 'bell'], 800, 10)
  group('P', '6A power', ['socket5', 'tv'], 1200, 6)
  group('H', '16A power', ['socket15'], 2000, 2)
  group('AC', 'AC', ['ac'], 1500, 1)
  group('G', 'Geyser', ['geyser'], 2000, 1)
  const phases = ['R', 'Y', 'B']
  circuits.forEach((c, i) => (c.phase = phases[i % 3]))
  for (const sbPoint of points.filter((p) => p.kind === 'switchboard')) sbPoint.circuit = 'SB'

  return {
    points,
    switchboards,
    db,
    circuits,
    connectedLoad: points.reduce((s, p) => s + p.watts, 0),
  }
}

// ---------------------------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------------------------

export interface PipeRun {
  id: string
  points: Point[]
  kind: 'cold' | 'hot' | 'soil' | 'waste' | 'storm'
  label?: string
}

export interface Chamber {
  id: string
  label: string
  x: number
  y: number
  kind: 'gully' | 'ic' | 'mh'
  invert: number
}

export function manhattan(a: Point, b: Point, horizontalFirst = true): Point[] {
  return horizontalFirst ? [a, { x: b.x, y: a.y }, b] : [a, { x: a.x, y: b.y }, b]
}

export function pathLength(points: Point[]) {
  let sum = 0
  for (let i = 1; i < points.length; i++) sum += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  return sum
}

/** Nearest exterior wall face to a point — where drains leave the building. */
function nearestExteriorExit(model: FloorModel, p: Point, roomId: string): { inner: Point; outer: Point; side: Side } | null {
  const walls = model.walls.filter((w) => w.exterior && w.outside)
  const own = walls.filter((w) => w.roomIds.includes(roomId))
  const pool = own.length ? own : walls
  let best: { inner: Point; outer: Point; side: Side; d: number } | null = null
  for (const w of pool) {
    const along = Math.min(w.to - 0.5, Math.max(w.from + 0.5, w.orientation === 'h' ? p.x : p.y))
    const inner = w.orientation === 'h' ? { x: along, y: w.at } : { x: w.at, y: along }
    const dir = OUTWARD[w.outside!]
    const outer = { x: inner.x + dir.x * (EXTERIOR_WALL + 1.5), y: inner.y + dir.y * (EXTERIOR_WALL + 1.5) }
    const d = Math.hypot(inner.x - p.x, inner.y - p.y)
    if (!best || d < best.d) best = { inner, outer, side: w.outside!, d }
  }
  return best
}

export interface WaterSupplyPlan {
  riser: Point | null
  runs: PipeRun[]
  fixtures: PlacedItem[]
  heaters: Point[]
}

export function waterSupplyPlan(model: FloorModel, items: PlacedItem[]): WaterSupplyPlan {
  const fixtures = items.filter((i) => i.kind === 'wc' || i.kind === 'basin' || i.kind === 'shower' || i.kind === 'sink')
  if (!fixtures.length) return { riser: null, runs: [], fixtures, heaters: [] }
  const wetRooms = model.rooms.filter((r) => fixtures.some((f) => f.roomId === r.id))
  const first = wetRooms.find((r) => r.type === 'wet') ?? wetRooms[0]
  const exit = nearestExteriorExit(model, center(first), first.id)
  const riser = exit ? { x: exit.inner.x, y: exit.inner.y } : center(first)
  const runs: PipeRun[] = []
  const heaters: Point[] = []
  for (const room of wetRooms) {
    const roomFixtures = fixtures.filter((f) => f.roomId === room.id)
    const entry = inside(room, riser.x, riser.y, 0.4)
    runs.push({ id: `cw-main-${room.id}`, kind: 'cold', points: manhattan(riser, entry), label: '25Ø CPVC' })
    for (const f of roomFixtures) {
      runs.push({ id: `cw-${f.id}`, kind: 'cold', points: manhattan(entry, center(f), false), label: '15Ø' })
    }
    const shower = roomFixtures.find((f) => f.kind === 'shower')
    if (room.type === 'wet' && shower) {
      const heater = inside(room, shower.x + shower.width, shower.y, 0.4)
      heaters.push(heater)
      for (const f of roomFixtures.filter((x) => x.kind === 'shower' || x.kind === 'basin')) {
        const c = center(f)
        runs.push({ id: `hw-${f.id}`, kind: 'hot', points: manhattan(heater, { x: c.x + 0.3, y: c.y + 0.3 }), label: '15Ø' })
      }
    }
  }
  return { riser, runs, fixtures, heaters }
}

export interface DrainagePlan {
  runs: PipeRun[]
  chambers: Chamber[]
  stacks: Point[]
  outfall: Point | null
}

function ringParam(ring: Rect, p: Point) {
  const { x, y, width: w, height: h } = ring
  if (Math.abs(p.y - y) < 0.01) return p.x - x
  if (Math.abs(p.x - (x + w)) < 0.01) return w + (p.y - y)
  if (Math.abs(p.y - (y + h)) < 0.01) return w + h + (x + w - p.x)
  return 2 * w + h + (y + h - p.y)
}

function ringPoint(ring: Rect, d: number): Point {
  const { x, y, width: w, height: h } = ring
  const per = 2 * (w + h)
  d = ((d % per) + per) % per
  if (d <= w) return { x: x + d, y }
  if (d <= w + h) return { x: x + w, y: y + d - w }
  if (d <= 2 * w + h) return { x: x + w - (d - w - h), y: y + h }
  return { x, y: y + h - (d - 2 * w - h) }
}

function snapToRing(ring: Rect, p: Point): Point {
  const candidates = [
    { x: Math.min(ring.x + ring.width, Math.max(ring.x, p.x)), y: ring.y },
    { x: Math.min(ring.x + ring.width, Math.max(ring.x, p.x)), y: ring.y + ring.height },
    { x: ring.x, y: Math.min(ring.y + ring.height, Math.max(ring.y, p.y)) },
    { x: ring.x + ring.width, y: Math.min(ring.y + ring.height, Math.max(ring.y, p.y)) },
  ]
  return candidates.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0]
}

/** Walks the ring (building perimeter offset) from a to b the short way round. */
function ringPath(ring: Rect, a: Point, b: Point): Point[] {
  const per = 2 * (ring.width + ring.height)
  const da = ringParam(ring, a)
  const db = ringParam(ring, b)
  let forward = (db - da + per) % per
  const dir = forward <= per / 2 ? 1 : -1
  if (dir < 0) forward = per - forward
  const corners = [0, ring.width, ring.width + ring.height, 2 * ring.width + ring.height]
  const pts = [a]
  const steps = corners
    .map((c) => ((c - da) * dir + per) % per)
    .filter((s) => s > 0.01 && s < forward - 0.01)
    .sort((x, y) => x - y)
  for (const s of steps) pts.push(ringPoint(ring, da + s * dir))
  pts.push(b)
  return pts
}

/**
 * Fixtures drain to the nearest exterior wall; on the lowest floor each outlet gets a gully /
 * inspection chamber on a ring around the building, chained at 1:40 to the road-side manhole.
 * Upper floors drop through soil/waste stacks on the external wall face.
 */
export function drainagePlan(model: FloorModel, items: PlacedItem[], upperStacks: Point[], front: Side): DrainagePlan {
  const fixtures = items.filter((i) => i.kind === 'wc' || i.kind === 'basin' || i.kind === 'shower' || i.kind === 'sink')
  const runs: PipeRun[] = []
  const stacks: Point[] = []
  const outlets: Point[] = []
  if (!model.footprint) return { runs, chambers: [], stacks, outfall: null }
  const ring = expand(model.footprint, 1.5)

  for (const f of fixtures) {
    const c = center(f)
    const exit = nearestExteriorExit(model, c, f.roomId)
    if (!exit) continue
    const kind = f.kind === 'wc' ? 'soil' : 'waste'
    if (model.isLowest) {
      const outer = snapToRing(ring, exit.outer)
      runs.push({ id: `dr-${f.id}`, kind, points: [c, exit.inner, outer], label: kind === 'soil' ? '100Ø' : '75Ø' })
      outlets.push(outer)
    } else {
      const stack = { x: (exit.inner.x + exit.outer.x) / 2, y: (exit.inner.y + exit.outer.y) / 2 }
      const existing = stacks.find((s) => Math.hypot(s.x - stack.x, s.y - stack.y) < 3)
      runs.push({ id: `dr-${f.id}`, kind, points: [c, exit.inner, existing ?? stack], label: kind === 'soil' ? '100Ø' : '75Ø' })
      if (!existing) stacks.push(stack)
    }
  }

  if (!model.isLowest) return { runs, chambers: [], stacks, outfall: null }

  for (const s of upperStacks) outlets.push(snapToRing(ring, s))

  const merged: Point[] = []
  for (const p of outlets) if (!merged.some((m) => Math.hypot(m.x - p.x, m.y - p.y) < 2.5)) merged.push(p)

  const fp = model.footprint
  const frontMid: Point = {
    N: { x: fp.x + fp.width / 2, y: ring.y },
    S: { x: fp.x + fp.width / 2, y: ring.y + ring.height },
    E: { x: ring.x + ring.width, y: fp.y + fp.height / 2 },
    W: { x: ring.x, y: fp.y + fp.height / 2 },
  }[front]
  const outDir = OUTWARD[front]
  const outfall = { x: frontMid.x + outDir.x * 6, y: frontMid.y + outDir.y * 6 }

  // Chain chambers from the farthest to the outfall along the ring.
  const per = 2 * (ring.width + ring.height)
  const target = ringParam(ring, frontMid)
  const dist = (p: Point) => {
    const d = Math.abs(ringParam(ring, p) - target)
    return Math.min(d, per - d)
  }
  const ordered = [...merged].sort((a, b) => dist(b) - dist(a))
  const chambers: Chamber[] = []
  let invert = -1.5
  let prev: Point | null = null
  for (const [i, p] of ordered.entries()) {
    if (prev) {
      const path = ringPath(ring, prev, p)
      invert -= pathLength(path) / 40
      runs.push({ id: `sw-${i}`, kind: 'soil', points: path, label: '150Ø SW 1:40' })
    }
    chambers.push({ id: `ic-${i}`, label: `IC${i + 1}`, x: p.x, y: p.y, kind: 'ic', invert: round2(invert) })
    prev = p
  }
  if (prev) {
    const path = [...ringPath(ring, prev, frontMid), outfall]
    invert -= pathLength(path) / 40
    runs.push({ id: 'sw-out', kind: 'soil', points: path, label: '150Ø SW to municipal sewer' })
  }
  chambers.push({ id: 'mh', label: 'MH', x: outfall.x, y: outfall.y, kind: 'mh', invert: round2(invert) })

  return { runs, chambers, stacks: upperStacks, outfall }
}
