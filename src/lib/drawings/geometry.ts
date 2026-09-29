import type { Floor, Plot, Room, RoomType } from '@/types/design'

/**
 * Derived building geometry shared by every drawing sheet and the 3D model sheets.
 * All values are feet in plot coordinates: x grows east, y grows south (y=0 is the north edge).
 */

export type Side = 'N' | 'E' | 'S' | 'W'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export const EXTERIOR_WALL = 0.75 // 9" brick
export const PARTITION_WALL = 0.375 // 4.5" brick
export const DEFAULT_FLOOR_HEIGHT = 10
export const SLAB_THICKNESS = 5 / 12
export const PARAPET_HEIGHT = 3.5
export const PLINTH_HEIGHT = 1.5

const EPS = 0.01

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function area(rect: Rect) {
  return rect.width * rect.height
}

export function center(rect: Rect): Point {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
}

export function intersects(a: Rect, b: Rect, gap = 0) {
  return (
    a.x < b.x + b.width + gap - EPS &&
    b.x < a.x + a.width + gap - EPS &&
    a.y < b.y + b.height + gap - EPS &&
    b.y < a.y + a.height + gap - EPS
  )
}

export function containsRect(outer: Rect, inner: Rect) {
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.width <= outer.x + outer.width + EPS &&
    inner.y + inner.height <= outer.y + outer.height + EPS
  )
}

export function expand(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, width: rect.width + by * 2, height: rect.height + by * 2 }
}

export function unionRect(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.width))
  const maxY = Math.max(...rects.map((r) => r.y + r.height))
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export const OUTWARD: Record<Side, Point> = {
  N: { x: 0, y: -1 },
  S: { x: 0, y: 1 },
  E: { x: 1, y: 0 },
  W: { x: -1, y: 0 },
}

export const OPPOSITE: Record<Side, Side> = { N: 'S', S: 'N', E: 'W', W: 'E' }

/** Axis-aligned bounds of a room, honouring Konva's rotate-about-top-left convention. */
export function roomRect(room: Room): Rect {
  const rotation = ((room.rotation % 360) + 360) % 360
  if (rotation === 0) return { x: room.x, y: room.y, width: room.width, height: room.height }
  const t = (rotation * Math.PI) / 180
  const cos = Math.cos(t)
  const sin = Math.sin(t)
  const xs = [0, room.width * cos, -room.height * sin, room.width * cos - room.height * sin]
  const ys = [0, room.width * sin, room.height * cos, room.width * sin + room.height * cos]
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  return {
    x: room.x + minX,
    y: room.y + minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  }
}

export interface PlanRoom extends Rect {
  id: string
  name: string
  type: RoomType
  room: Room
}

export function planRooms(floor: Floor): PlanRoom[] {
  return floor.rooms
    .filter((room) => room.visible)
    .map((room) => ({ ...roomRect(room), id: room.id, name: room.label ?? room.name, type: room.type, room }))
}

// ---------------------------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------------------------

export interface WallSegment {
  id: string
  orientation: 'h' | 'v'
  /** The fixed coordinate of the room edge: y for horizontal walls, x for vertical ones. */
  at: number
  from: number
  to: number
  exterior: boolean
  /** Exterior walls only: which side of the room edge is outside the building. */
  outside: Side | null
  roomIds: string[]
  thickness: number
}

/**
 * Walls are derived from room edges: an edge stretch shared by rooms on both sides is a
 * partition, a stretch with rooms on one side only is an exterior wall.
 */
export function deriveWalls(rooms: PlanRoom[]): WallSegment[] {
  interface Edge {
    orientation: 'h' | 'v'
    at: number
    from: number
    to: number
    roomId: string
    /** Which of the room's own sides this edge is — also the direction away from that room. */
    side: Side
  }

  const groups = new Map<string, Edge[]>()
  const push = (edge: Edge) => {
    const key = `${edge.orientation}:${round2(edge.at)}`
    const list = groups.get(key)
    if (list) list.push(edge)
    else groups.set(key, [edge])
  }

  for (const r of rooms) {
    push({ orientation: 'h', at: r.y, from: r.x, to: r.x + r.width, roomId: r.id, side: 'N' })
    push({ orientation: 'h', at: r.y + r.height, from: r.x, to: r.x + r.width, roomId: r.id, side: 'S' })
    push({ orientation: 'v', at: r.x, from: r.y, to: r.y + r.height, roomId: r.id, side: 'W' })
    push({ orientation: 'v', at: r.x + r.width, from: r.y, to: r.y + r.height, roomId: r.id, side: 'E' })
  }

  const walls: WallSegment[] = []
  for (const edges of groups.values()) {
    const { orientation } = edges[0]
    const at = round2(edges[0].at)
    const stops = [...new Set(edges.flatMap((e) => [round2(e.from), round2(e.to)]))].sort((a, b) => a - b)
    let current: WallSegment | null = null
    let currentKey = ''
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i]
      const b = stops[i + 1]
      if (b - a < EPS) continue
      const covering = edges.filter((e) => e.from <= a + EPS && e.to >= b - EPS)
      if (covering.length === 0) {
        current = null
        continue
      }
      const sides = new Set(covering.map((e) => e.side))
      const exterior = sides.size === 1
      const outside = exterior ? covering[0].side : null
      const roomIds = [...new Set(covering.map((e) => e.roomId))].sort()
      const key = `${exterior}|${outside}|${roomIds.join(',')}`
      if (current && Math.abs(current.to - a) < EPS && key === currentKey) {
        current.to = b
        continue
      }
      current = {
        id: `w-${orientation}-${at}-${a}`,
        orientation,
        at,
        from: a,
        to: b,
        exterior,
        outside,
        roomIds,
        thickness: exterior ? EXTERIOR_WALL : PARTITION_WALL,
      }
      currentKey = key
      walls.push(current)
    }
  }
  return walls
}

export function wallLength(wall: WallSegment) {
  return wall.to - wall.from
}

/** Offset of the wall's centreline from the room edge (exterior walls sit outside the room). */
export function wallCenterOffset(wall: WallSegment) {
  if (!wall.exterior || !wall.outside) return 0
  const dir = OUTWARD[wall.outside]
  return (wall.orientation === 'h' ? dir.y : dir.x) * (wall.thickness / 2)
}

/**
 * Solid footprint of a wall. Ends are extended so corners close; any overshoot into a room is
 * hidden because plans paint room floors after exterior walls.
 */
export function wallRect(wall: WallSegment): Rect {
  const t = wall.thickness
  const centre = wall.at + wallCenterOffset(wall)
  const ext = wall.exterior ? t : t / 2
  const start = wall.from - ext
  const length = wall.to - wall.from + ext * 2
  return wall.orientation === 'h'
    ? { x: start, y: centre - t / 2, width: length, height: t }
    : { x: centre - t / 2, y: start, width: t, height: length }
}

/** Which side of the wall line the given room lies on. */
export function sideOfWall(wall: WallSegment, rect: Rect): Side {
  const c = center(rect)
  if (wall.orientation === 'h') return c.y < wall.at ? 'N' : 'S'
  return c.x < wall.at ? 'W' : 'E'
}

/** Point along the wall's room edge, in plot coordinates. */
export function pointOnWall(wall: WallSegment, along: number, offset = 0): Point {
  return wall.orientation === 'h' ? { x: along, y: wall.at + offset } : { x: wall.at + offset, y: along }
}

/** The room edge a wall side corresponds to. */
export function roomSideOfWall(wall: WallSegment, room: Rect): Side {
  return OPPOSITE[sideOfWall(wall, room)]
}

// ---------------------------------------------------------------------------------------------
// Openings (doors & windows)
// ---------------------------------------------------------------------------------------------

export type PlanOpeningKind = 'door' | 'main-door' | 'window' | 'ventilator'

export interface PlanOpening {
  id: string
  kind: PlanOpeningKind
  wall: WallSegment
  /** Along-wall coordinate of the opening centre (x for horizontal walls, y for vertical). */
  center: number
  width: number
  /** Doors only: the side of the wall line the leaf swings toward. */
  swingSide: Side | null
  hingeAtStart: boolean
  sill: number
  height: number
  roomIds: string[]
}

export function isDoor(opening: PlanOpening) {
  return opening.kind === 'door' || opening.kind === 'main-door'
}

function pairWeight(a: RoomType, b: RoomType) {
  const types = [a, b].sort().join('+')
  if (a === 'circulation' || b === 'circulation') return 1
  switch (types) {
    case 'kitchen+living':
    case 'living+pooja':
      return 1
    case 'bedroom+living':
    case 'kitchen+utility':
    case 'living+utility':
      return 2
    case 'bedroom+wet':
    case 'living+wet':
      return 3
    case 'bedroom+utility':
      return 4
    case 'bedroom+kitchen':
      return 6
    case 'utility+wet':
      return 7
    case 'bedroom+bedroom':
      return 8
    case 'kitchen+wet':
      return 9
    default:
      return 5
  }
}

function swingInto(a: PlanRoom, b: PlanRoom): PlanRoom {
  if (a.type === 'wet') return a
  if (b.type === 'wet') return b
  if (a.type === 'circulation' || a.type === 'living') return b
  if (b.type === 'circulation' || b.type === 'living') return a
  return b
}

export function frontSide(plot: Plot): Side {
  return SETBACK_SIDES[plot.facing].front
}

/** Maps front/rear/left/right setbacks to compass sides for the plot's road facing. */
export const SETBACK_SIDES: Record<Plot['facing'], Record<'front' | 'rear' | 'left' | 'right', Side>> = {
  north: { front: 'N', rear: 'S', left: 'W', right: 'E' },
  east: { front: 'E', rear: 'W', left: 'N', right: 'S' },
  south: { front: 'S', rear: 'N', left: 'E', right: 'W' },
  west: { front: 'W', rear: 'E', left: 'S', right: 'N' },
}

/**
 * Doors form a minimum spanning tree over room adjacency (so every room is reachable without
 * bedroom-to-bedroom doors), the main door goes on the entrance room's road-facing wall, and
 * every habitable room gets a window on each exterior wall.
 */
export function deriveOpenings(rooms: PlanRoom[], walls: WallSegment[], plot: Plot, isEntranceFloor: boolean) {
  const byId = new Map(rooms.map((r) => [r.id, r]))
  const openings: PlanOpening[] = []

  // Longest shared partition for each adjacent pair of rooms.
  const shared = new Map<string, WallSegment>()
  for (const wall of walls) {
    if (wall.exterior || wall.roomIds.length < 2) continue
    const key = wall.roomIds.slice(0, 2).join('|')
    const best = shared.get(key)
    if (!best || wallLength(wall) > wallLength(best)) shared.set(key, wall)
  }

  const candidates = [...shared.entries()]
    .map(([key, wall]) => {
      const [a, b] = key.split('|').map((id) => byId.get(id)!)
      return { a, b, wall, weight: pairWeight(a.type, b.type) }
    })
    .filter(({ a, b, wall }) => wallLength(wall) >= (a.type === 'wet' || b.type === 'wet' ? 3.5 : 4))
    .sort((x, y) => x.weight - y.weight || wallLength(y.wall) - wallLength(x.wall))

  const parent = new Map(rooms.map((r) => [r.id, r.id]))
  const find = (id: string): string => {
    const p = parent.get(id)!
    if (p === id) return id
    const root = find(p)
    parent.set(id, root)
    return root
  }

  for (const { a, b, wall } of candidates) {
    const ra = find(a.id)
    const rb = find(b.id)
    if (ra === rb) continue
    parent.set(ra, rb)
    const width = a.type === 'wet' || b.type === 'wet' ? 2.5 : 3
    const length = wallLength(wall)
    const centerAlong = length > width + 4 ? wall.from + 1 + width / 2 : (wall.from + wall.to) / 2
    const target = swingInto(a, b)
    openings.push({
      id: `door-${a.id}-${b.id}`,
      kind: 'door',
      wall,
      center: centerAlong,
      width,
      swingSide: sideOfWall(wall, target),
      hingeAtStart: true,
      sill: 0,
      height: 7,
      roomIds: [a.id, b.id],
    })
  }

  const front = frontSide(plot)
  if (isEntranceFloor) {
    const frontWalls = walls.filter((w) => w.exterior && w.outside === front && wallLength(w) >= 4.5)
    const rank = (w: WallSegment) => {
      const type = byId.get(w.roomIds[0])?.type
      return type === 'circulation' ? 0 : type === 'living' ? 1 : 2
    }
    const entrance = frontWalls.sort((a, b) => rank(a) - rank(b) || wallLength(b) - wallLength(a))[0]
    if (entrance) {
      openings.push({
        id: 'main-door',
        kind: 'main-door',
        wall: entrance,
        center: (entrance.from + entrance.to) / 2,
        width: 3.5,
        swingSide: OPPOSITE[front],
        hingeAtStart: true,
        sill: 0,
        height: 7,
        roomIds: [...entrance.roomIds],
      })
    }
  }

  for (const wall of walls) {
    if (!wall.exterior) continue
    const room = byId.get(wall.roomIds[0])
    if (!room || room.type === 'circulation') continue
    const length = wallLength(wall)
    let kind: PlanOpeningKind = 'window'
    let width = Math.min(5, Math.max(3, Math.round(length * 0.4 * 2) / 2))
    let sill = 3
    let height = 4
    if (room.type === 'wet') {
      kind = 'ventilator'
      width = 2
      sill = 5.5
      height = 1.5
    } else if (room.type === 'kitchen') {
      width = 4
      sill = 3.5
      height = 3.5
    } else if (room.type === 'pooja') {
      width = 2.5
    } else if (room.type === 'utility') {
      width = 3
    }
    if (length < width + 1.5) continue

    let centerAlong = (wall.from + wall.to) / 2
    const door = openings.find((o) => o.wall.id === wall.id)
    if (door) {
      const before = door.center - door.width / 2 - wall.from
      const after = wall.to - (door.center + door.width / 2)
      const room2 = Math.max(before, after)
      if (room2 < width + 1.5) continue
      centerAlong = before > after ? wall.from + before / 2 : door.center + door.width / 2 + after / 2
    }
    openings.push({
      id: `${kind}-${wall.id}`,
      kind,
      wall,
      center: centerAlong,
      width,
      swingSide: null,
      hingeAtStart: true,
      sill,
      height,
      roomIds: [...wall.roomIds],
    })
  }

  return openings
}

// ---------------------------------------------------------------------------------------------
// Floors, plot & areas
// ---------------------------------------------------------------------------------------------

export function sortFloors(floors: Floor[]) {
  return [...floors].sort((a, b) => a.level - b.level)
}

/** Floor-to-floor height; the top floor uses its tallest room plus a slab. */
export function floorHeight(floor: Floor, floors: Floor[]) {
  const sorted = sortFloors(floors)
  const next = sorted[sorted.findIndex((f) => f.id === floor.id) + 1]
  if (next) return Math.max(7, next.elevation - floor.elevation)
  const tallest = Math.max(0, ...floor.rooms.map((r) => r.wallHeight))
  return Math.max(DEFAULT_FLOOR_HEIGHT, Math.ceil(tallest + 1))
}

export interface FloorModel {
  floor: Floor
  rooms: PlanRoom[]
  walls: WallSegment[]
  openings: PlanOpening[]
  /** Outer face of the building footprint, including exterior wall thickness. */
  footprint: Rect | null
  height: number
  isLowest: boolean
}

export function buildFloorModel(floor: Floor, floors: Floor[], plot: Plot): FloorModel {
  const rooms = planRooms(floor)
  const walls = deriveWalls(rooms)
  const lowest = sortFloors(floors)[0]
  const isLowest = lowest?.id === floor.id
  const openings = deriveOpenings(rooms, walls, plot, isLowest)
  const inner = unionRect(rooms)
  return {
    floor,
    rooms,
    walls,
    openings,
    footprint: inner ? expand(inner, EXTERIOR_WALL) : null,
    height: floorHeight(floor, floors),
    isLowest,
  }
}

export function buildBuildingModel(floors: Floor[], plot: Plot) {
  return sortFloors(floors).map((floor) => buildFloorModel(floor, floors, plot))
}

export function requiredSetbacks(plot: Plot): Record<Side, number> {
  const sides = SETBACK_SIDES[plot.facing]
  return {
    [sides.front]: plot.setbacks.front,
    [sides.rear]: plot.setbacks.rear,
    [sides.left]: plot.setbacks.left,
    [sides.right]: plot.setbacks.right,
  } as Record<Side, number>
}

export function providedSetbacks(plot: Plot, footprint: Rect): Record<Side, number> {
  return {
    N: round2(footprint.y),
    S: round2(plot.height - footprint.y - footprint.height),
    W: round2(footprint.x),
    E: round2(plot.width - footprint.x - footprint.width),
  }
}

export function wallsArea(walls: WallSegment[]) {
  return walls.reduce((sum, w) => sum + wallLength(w) * w.thickness, 0)
}

export function areaStatement(plot: Plot, models: FloorModel[]) {
  const plotArea = plot.width * plot.height
  const perFloor = models.map((m) => {
    const carpet = m.rooms.reduce((sum, r) => sum + area(r), 0)
    return { name: m.floor.name, carpet, builtUp: carpet + wallsArea(m.walls) }
  })
  const ground = perFloor[0]?.builtUp ?? 0
  const total = perFloor.reduce((sum, f) => sum + f.builtUp, 0)
  return {
    plotArea,
    perFloor,
    groundCoverage: plotArea ? ground / plotArea : 0,
    totalBuiltUp: total,
    far: plotArea ? total / plotArea : 0,
    openSpace: Math.max(0, plotArea - ground),
  }
}

/** A section cut line placed near the footprint middle but clear of wall lines. */
export function sectionCut(walls: WallSegment[], footprint: Rect, axis: 'x' | 'y') {
  const orientation = axis === 'x' ? 'v' : 'h'
  const lines = walls.filter((w) => w.orientation === orientation).map((w) => w.at)
  const start = axis === 'x' ? footprint.x : footprint.y
  const size = axis === 'x' ? footprint.width : footprint.height
  let cut = start + size / 2
  for (let i = 0; i < 12 && lines.some((l) => Math.abs(l - cut) < 1.5); i++) {
    cut += i % 2 === 0 ? 1.75 * (i + 1) : -1.75 * (i + 1)
  }
  return round2(cut)
}

export function formatFeet(feet: number) {
  const sign = feet < 0 ? '-' : ''
  const abs = Math.abs(feet)
  let ft = Math.floor(abs + 1e-6)
  let inches = Math.round((abs - ft) * 12)
  if (inches === 12) {
    ft += 1
    inches = 0
  }
  return `${sign}${ft}'-${inches}"`
}

export function formatLevel(feet: number) {
  return `${feet >= 0 ? '+' : ''}${formatFeet(feet)}`
}
