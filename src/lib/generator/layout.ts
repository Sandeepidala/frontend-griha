import { EXTERIOR_WALL, requiredSetbacks } from '@/lib/drawings/geometry'
import type { Plot, RoomType } from '@/types/design'
import { PASSAGE_DEPTH, STAIR_DEPTH, type Band, type FloorProgram, type ProgramRoom } from './program'

/** A rectangle in "road space": `u` runs along the road, `v` runs back from it. */
interface RoadRect {
  u: number
  v: number
  a: number
  d: number
}

export interface PlacedRoom {
  key: string
  name: string
  type: RoomType
  finish: ProgramRoom['finish']
  rect: RoadRect
}

export interface LayoutVariant {
  /** Mirror the whole plan along the road (swaps left and right). */
  mirror: boolean
  stairEnd: 'start' | 'end'
  parkingEnd: 'start' | 'end'
  /** Which side of its bedroom a suite's bathroom column goes on. */
  bathSide: 'start' | 'end'
  /** A passage between the middle and rear bands, so rear rooms open onto it. */
  passage: boolean
  /** On a plot larger than the house needs, where the house sits along the frontage. */
  align: 'start' | 'center' | 'end'
  /** Picks the left-to-right order of rooms within each band. */
  shuffle: <T>(items: T[]) => T[]
}

export interface Envelope {
  /** Compass-space origin and size of the buildable area (inside setbacks and outer walls). */
  x: number
  y: number
  width: number
  height: number
  /** Road-space size: along the road, and back from it. */
  length: number
  depth: number
}

/** The house's footprint in road space: `offset` along the road from the envelope's start. */
export interface Frame {
  length: number
  depth: number
  offset: number
}

export interface BandDepths {
  front: number
  middle: number
  passage: number
  rear: number
}

const GRID = 0.5
const snap = (n: number) => Math.round(n / GRID) * GRID
/** Rounds down to the grid, for sizes that must never exceed a limit (the buildable area). */
const snapDown = (n: number) => Math.floor(n / GRID + 1e-9) * GRID
const BANDS: Band[] = ['front', 'middle', 'rear']

/** Narrowest a room should get along the road; a suite needs a bedroom plus its bathroom column. */
const MIN_ALONG: Partial<Record<RoomType, number>> = { living: 10, bedroom: 9, kitchen: 7, wet: 5, pooja: 5, utility: 5, circulation: 4.5 }
const minWidth = (r: ProgramRoom) => r.fixedWidth ?? (r.attachedBath ? 14 : (MIN_ALONG[r.type] ?? 5))
/** Only service rooms may be stacked two deep; living rooms and bedrooms always get the band's full depth. */
const STACKABLE: RoomType[] = ['wet', 'utility', 'pooja', 'circulation', 'kitchen']
/** Rooms that need daylight: in a middle band they belong at the ends, next to the outside walls. */
const HABITABLE: RoomType[] = ['living', 'bedroom', 'kitchen', 'pooja']

/** Rooms stay inside the setbacks, with room for the outer walls, which sit outside room edges. */
export function buildableEnvelope(plot: Plot): Envelope | null {
  const s = requiredSetbacks(plot)
  const x = s.W + EXTERIOR_WALL
  const y = s.N + EXTERIOR_WALL
  const width = plot.width - s.E - EXTERIOR_WALL - x
  const height = plot.height - s.S - EXTERIOR_WALL - y
  if (width < 12 || height < 20) return null
  const alongX = plot.facing === 'north' || plot.facing === 'south'
  return { x, y, width, height, length: alongX ? width : height, depth: alongX ? height : width }
}

/** Road space → compass space for the plot's facing (the plan is always drawn north-up). */
export function toCompass(r: RoadRect, env: Envelope, facing: Plot['facing']) {
  switch (facing) {
    case 'north':
      return { x: env.x + r.u, y: env.y + r.v, width: r.a, height: r.d }
    case 'south':
      return { x: env.x + r.u, y: env.y + env.height - r.v - r.d, width: r.a, height: r.d }
    case 'east':
      return { x: env.x + env.width - r.v - r.d, y: env.y + r.u, width: r.d, height: r.a }
    case 'west':
      return { x: env.x + r.v, y: env.y + r.u, width: r.d, height: r.a }
  }
}

/** Weight of a room when sharing a band's length; a suite counts its bathroom too. */
export const shareOf = (room: ProgramRoom) => room.area + (room.attachedBath ? room.attachedBath.area + 15 : 0)

/**
 * Moves rooms marked movable between bands until no band is asked to fit more minimum width than
 * the plot has: a small greedy search that always makes the single move that most reduces the total
 * overflow, so chains work (the living room moves back, the store moves to the rear to make room).
 */
export function rebalance(program: FloorProgram, length: number): FloorProgram {
  const rooms = program.rooms.map((r) => ({ ...r }))
  const need = (band: Band) => rooms.filter((r) => r.band === band).reduce((s, r) => s + minWidth(r), 0)
  const overflow = () => BANDS.reduce((s, b) => s + Math.max(0, need(b) - length), 0)
  for (let step = 0; step < 12; step++) {
    const current = overflow()
    if (current <= 0) break
    let best: { room: ProgramRoom; band: Band; value: number } | null = null
    for (const room of rooms.filter((r) => r.movable)) {
      const from = room.band
      for (const band of BANDS) {
        if (band === from) continue
        room.band = band
        const value = overflow()
        room.band = from
        // Living rooms prefer to stay at the front, so they move only when that clearly helps.
        const penalty = room.type === 'living' ? 0.5 : 0
        if (value + penalty < current && (!best || value + penalty < best.value)) best = { room, band, value: value + penalty }
      }
    }
    if (!best) break
    best.room.band = best.band
  }

  // Daylight: the middle band has outside walls only at its two ends (fewer if the stairs take one).
  // Extra habitable rooms there move to the front or rear, where every room gets an outside wall.
  const ideal = (r: ProgramRoom) => Math.max(minWidth(r), shareOf(r) / 12)
  const spare = (band: Band) => length - rooms.filter((r) => r.band === band).reduce((s, r) => s + ideal(r), 0)
  const ends = 2 - rooms.filter((r) => r.band === 'middle' && r.role === 'stair').length
  for (let step = 0; step < 6; step++) {
    const lit = rooms.filter((r) => r.band === 'middle' && HABITABLE.includes(r.type))
    if (lit.length <= ends) break
    const room = lit.filter((r) => r.movable).sort((a, b) => ideal(b) - ideal(a))[0]
    const target = room && (['rear', 'front'] as const).filter((b) => spare(b) >= ideal(room)).sort((a, b) => spare(b) - spare(a))[0]
    if (!room || !target) break
    room.band = target
  }
  return { ...program, rooms }
}

/**
 * Splits [start, start + length] into consecutive spans proportional to weights, on the 0.5 ft grid.
 * With minimums, each span gets at least its minimum first (if the total allows) and the rest in proportion.
 */
function spans(start: number, length: number, weights: number[], minimums: number[] = weights.map(() => 0)) {
  const sizes = weights.map(() => 0)
  const fixed = weights.map(() => false)
  if (minimums.reduce((s, m) => s + m, 0) > length) {
    // Not even the minimums fit: share in proportion to them instead.
    minimums.forEach((m, i) => (sizes[i] = m))
  } else {
    for (let pass = 0; pass < weights.length; pass++) {
      const free = length - sizes.reduce((s, v, i) => s + (fixed[i] ? v : 0), 0)
      const weight = weights.reduce((s, w, i) => s + (fixed[i] ? 0 : w), 0) || 1
      let changed = false
      weights.forEach((w, i) => {
        if (fixed[i]) return
        sizes[i] = (free * w) / weight
        if (sizes[i] < minimums[i]) {
          sizes[i] = minimums[i]
          fixed[i] = true
          changed = true
        }
      })
      if (!changed) break
    }
  }
  const total = sizes.reduce((s, v) => s + v, 0) || 1
  const edges = [start]
  let acc = 0
  sizes.forEach((v, i) => {
    acc += v
    edges.push(i === sizes.length - 1 ? start + length : snap(start + (length * acc) / total))
  })
  return sizes.map((_, i) => ({ from: edges[i], size: edges[i + 1] - edges[i] }))
}

/**
 * A bedroom with its attached bathroom: the bedroom runs the band's full depth (a door onto the
 * passage, a window on the outside wall), beside a column with the bathroom against the outside wall
 * and a small dress/lobby between it and the passage.
 */
function placeSuite(room: ProgramRoom, u: number, a: number, v: number, d: number, outside: 'front' | 'rear', variant: LayoutVariant): PlacedRoom[] {
  const bath = room.attachedBath!
  const columnWidth = Math.min(a - 8, a >= 16 ? 5.5 : 5)
  if (columnWidth < 4.5) {
    // Too narrow for a side column: the bathroom runs across the outside end of the suite instead.
    const bathDepth = snap(Math.min(d - 8, Math.max(5, bath.area / a)))
    const bathV = outside === 'rear' ? v + d - bathDepth : v
    return [
      { key: room.key, name: room.name, type: 'bedroom', finish: room.finish, rect: { u, v: outside === 'rear' ? v : v + bathDepth, a, d: d - bathDepth } },
      { key: bath.key, name: bath.name, type: 'wet', finish: 'tile', rect: { u, v: bathV, a, d: bathDepth } },
    ]
  }
  const bathDepth = snap(Math.min(d - 3, Math.max(6.5, bath.area / columnWidth)))
  const bedroomWidth = a - columnWidth
  const columnU = variant.bathSide === 'start' ? u : u + bedroomWidth
  const bedroomU = variant.bathSide === 'start' ? u + columnWidth : u
  const bathV = outside === 'rear' ? v + d - bathDepth : v
  const placed: PlacedRoom[] = [
    { key: room.key, name: room.name, type: 'bedroom', finish: room.finish, rect: { u: bedroomU, v, a: bedroomWidth, d } },
    { key: bath.key, name: bath.name, type: 'wet', finish: 'tile', rect: { u: columnU, v: bathV, a: columnWidth, d: bathDepth } },
  ]
  if (d - bathDepth >= 3) {
    const dressV = outside === 'rear' ? v : v + bathDepth
    placed.push({ key: `${room.key}-dress`, name: 'Dress', type: 'circulation', finish: 'tile', rect: { u: columnU, v: dressV, a: columnWidth, d: d - bathDepth } })
  }
  return placed
}

/** Longest a room should run along the band, as a multiple of its depth. */
const MAX_PROPORTION = 2
const CAPPED: RoomType[] = ['living', 'bedroom', 'kitchen', 'pooja', 'utility']

function layoutRow(rooms: ProgramRoom[], u: number, length: number, v: number, d: number, outside: 'front' | 'rear', variant: LayoutVariant, level: number) {
  // On a generous band, rooms would stretch into corridors; cap them and leave the rest open instead.
  const cap = (r: ProgramRoom) => (CAPPED.includes(r.type) ? MAX_PROPORTION * d + (r.attachedBath ? 5.5 : 0) : Infinity)
  const ideal = spans(u, length, rooms.map(shareOf), rooms.map(minWidth))
  const capped = rooms.map((r, i) => Math.min(ideal[i].size, cap(r)))
  // Exactly what's left, so the row always ends at the band's edge (never past the setback line).
  const leftover = length - capped.reduce((s, w) => s + w, 0)
  if (leftover >= 4 && capped.some((w, i) => w < ideal[i].size)) {
    const open: ProgramRoom = { key: `${rooms[0].key}-open`, name: level === 0 ? 'Sit-out' : 'Balcony', type: 'circulation', area: leftover * d, band: 'front', finish: 'tile' }
    const all = [...rooms, open]
    // The open space goes at the end of the row, against an outside wall.
    return layoutRowExact(all, u, [...capped, leftover], v, d, outside, variant)
  }
  return layoutRowExact(rooms, u, ideal.map((s) => s.size), v, d, outside, variant)
}

function layoutRowExact(rooms: ProgramRoom[], u: number, widths: number[], v: number, d: number, outside: 'front' | 'rear', variant: LayoutVariant) {
  let from = u
  return widths.flatMap((size, i): PlacedRoom[] => {
    const at = from
    from += size
    const room = rooms[i]
    if (room.attachedBath) return placeSuite(room, at, size, v, d, outside, variant)
    return [{ key: room.key, name: room.name, type: room.type, finish: room.finish, rect: { u: at, v, a: size, d } }]
  })
}

function layoutBand(rooms: ProgramRoom[], band: Band, length: number, v: number, d: number, variant: LayoutVariant, level: number): PlacedRoom[] {
  if (rooms.length === 0 || d <= 0) return []
  const placed: PlacedRoom[] = []
  const outside = band === 'front' ? 'front' : 'rear'
  let start = 0
  let end = length

  // Parking, the foyer beside it, and the staircase keep their widths, at their chosen ends.
  const pinned = rooms.filter((r) => r.fixedWidth).sort((a, b) => (a.role === 'parking' ? -1 : b.role === 'parking' ? 1 : 0))
  for (const room of pinned) {
    // Parking may take most of the band; the stair and foyer less, so other rooms still fit.
    const width = Math.min(room.fixedWidth!, snap((end - start) * (room.role === 'parking' ? 0.8 : 0.6)))
    const atEnd = (room.role === 'stair' ? variant.stairEnd : variant.parkingEnd) === 'end'
    const u = atEnd ? end - width : start
    placed.push({ key: room.key, name: room.name, type: room.type, finish: room.finish, rect: { u, v, a: width, d } })
    if (atEnd) end -= width
    else start += width
  }

  let rest = variant.shuffle(rooms.filter((r) => !r.fixedWidth))
  if (band === 'middle' && rest.length >= 2) {
    // Only the ends of the middle band touch an outside wall: habitable rooms go at whichever ends
    // the staircase leaves free, with service rooms between.
    const habitable = rest.filter((r) => HABITABLE.includes(r.type))
    const service = rest.filter((r) => !HABITABLE.includes(r.type))
    const stair = pinned.find((r) => r.role === 'stair')
    if (!stair) rest = [...habitable.slice(0, 1), ...service, ...habitable.slice(2), ...habitable.slice(1, 2)]
    else if (variant.stairEnd === 'start') rest = [...service, ...habitable.slice(1), ...habitable.slice(0, 1)]
    else rest = [...habitable.slice(0, 1), ...habitable.slice(1), ...service]
  }
  const free = end - start
  if (free <= 0) return placed
  if (rest.length === 0) {
    if (level > 0) {
      // Only a staircase here (typical upstairs): the rest of the band is its landing, big enough to sit in.
      const name = free * d >= 100 ? 'Upper Lounge' : 'Lobby'
      placed.push({ key: `${band}-lobby`, name, type: 'circulation', finish: 'tile', rect: { u: start, v, a: free, d } })
    } else {
      // Ground floor: the foyer takes up the leftover strip rather than leaving a gap.
      const foyer = placed.find((p) => p.key === 'foyer')
      if (foyer) {
        const touchesStart = Math.abs(foyer.rect.u + foyer.rect.a - start) < 0.01
        foyer.rect = touchesStart ? { ...foyer.rect, a: foyer.rect.a + free } : { ...foyer.rect, u: foyer.rect.u - free, a: foyer.rect.a + free }
      }
    }
    return placed
  }

  const total = rest.reduce((s, r) => s + shareOf(r), 0)
  const cramped = rest.some((r) => (free * shareOf(r)) / total < minWidth(r))
  const stackable = rest.filter((r) => STACKABLE.includes(r.type) && !r.attachedBath)
  if (cramped && stackable.length >= 2 && d >= 12) {
    // Two service rooms share one column, one behind the other; everything else keeps full depth.
    const [a, b] = stackable.slice(-2)
    const column: ProgramRoom = { ...a, key: `${a.key}+${b.key}`, area: a.area + b.area }
    const row = rest.filter((r) => r !== a && r !== b)
    row.splice(Math.min(row.length, Math.floor(rest.indexOf(a) / 2)), 0, column)
    for (const piece of layoutRow(row, start, free, v, d, outside, variant, level)) {
      if (piece.key !== column.key) {
        placed.push(piece)
        continue
      }
      // Each stacked room at least 5 ft deep, the rest in proportion to their areas.
      const split = snap(Math.min(d - 5, Math.max(5, d * (a.area / column.area))))
      placed.push(
        { key: a.key, name: a.name, type: a.type, finish: a.finish, rect: { ...piece.rect, d: split } },
        { key: b.key, name: b.name, type: b.type, finish: b.finish, rect: { ...piece.rect, v: piece.rect.v + split, d: d - split } },
      )
    }
  } else {
    placed.push(...layoutRow(rest, start, free, v, d, outside, variant, level))
  }
  return placed
}

/** Minimum band depths: a car bay's length, a staircase's run, a bedroom's depth. */
function bandMinimums(programs: FloorProgram[]) {
  const weight = (band: Band) => Math.max(...programs.map((p) => p.rooms.filter((r) => r.band === band).reduce((s, r) => s + shareOf(r), 0)))
  const parking = programs[0]?.rooms.find((r) => r.role === 'parking')
  return {
    front: parking ? Math.max(9, parking.area / (parking.fixedWidth ?? 1)) : weight('front') > 0 ? 10 : 0,
    middle: programs.some((p) => p.rooms.some((r) => r.role === 'stair')) ? STAIR_DEPTH : weight('middle') > 0 ? 8 : 0,
    rear: weight('rear') > 0 ? 11 : 0,
  }
}

/**
 * The house's footprint. On a tight plot it's the whole buildable area; on a larger one it's sized
 * to what the busiest floor needs (at least three bands deep), and the rest stays open as garden or
 * side yard, instead of stretching every room.
 */
export function footprintFor(env: Envelope, programs: FloorProgram[], align: LayoutVariant['align'], passage: boolean, maxArea = Infinity): Frame {
  const busiest = Math.max(...programs.map((p) => p.rooms.reduce((s, r) => s + shareOf(r), 0)))
  const minima = bandMinimums(programs)
  // At least as long as the fullest band's rooms side by side at their minimum widths.
  const minLength = Math.min(env.length, Math.max(...programs.flatMap((p) => BANDS.map((b) => p.rooms.filter((r) => r.band === b).reduce((s, r) => s + minWidth(r), 0)))))
  const minDepth = Math.min(env.depth, Math.max(30, minima.front + minima.middle + minima.rear + (passage ? PASSAGE_DEPTH : 0)))
  // Walls and circulation take roughly an eighth on top of the rooms themselves.
  const needed = (length: number) => busiest * 1.12 + (passage ? length * PASSAGE_DEPTH : 0)
  let length = env.length
  let depth = env.depth
  if (length * depth <= needed(length) * 1.15 && length * depth <= maxArea) return { length, depth, offset: 0 }
  for (let pass = 0; pass < 2; pass++) {
    depth = Math.min(env.depth, Math.max(minDepth, needed(length) / length))
    length = Math.min(env.length, Math.max(20, minLength, needed(length) / depth))
  }
  // Never more ground coverage than the bye-laws allow: shallower first, then shorter.
  if (length * depth > maxArea) depth = Math.max(Math.min(minDepth, depth), maxArea / length)
  if (length * depth > maxArea) length = Math.max(20, maxArea / depth)
  length = snapDown(length)
  depth = snapDown(depth)
  const spare = env.length - length
  return { length, depth, offset: align === 'start' ? 0 : align === 'end' ? spare : snap(spare / 2) }
}

/**
 * Depths of the front, middle and rear bands, shared by every floor so the staircase lines up,
 * in proportion to the rooms each holds, with minimums for parking, stairs and bedrooms. On a
 * shallow plot the passage goes first, then every band is scaled down together.
 */
export function bandDepths(programs: FloorProgram[], depth: number, passage: boolean): BandDepths {
  const inBand = (band: Band) => programs.map((p) => p.rooms.filter((r) => r.band === band))
  const weight = Object.fromEntries(BANDS.map((b) => [b, Math.max(...inBand(b).map((rooms) => rooms.reduce((s, r) => s + shareOf(r), 0)))])) as Record<Band, number>
  const minimum: Record<Band, number> = bandMinimums(programs)
  const wantsPassage = passage && inBand('rear').some((rooms) => rooms.length >= 2)
  const minTotal = BANDS.reduce((s, b) => s + minimum[b], 0)
  const passageDepth = wantsPassage && depth - PASSAGE_DEPTH >= minTotal ? PASSAGE_DEPTH : 0
  const available = depth - passageDepth
  if (minTotal > available) {
    const scale = available / minTotal
    const front = snap(minimum.front * scale)
    const middle = snap(minimum.middle * scale)
    return { front, middle, passage: 0, rear: available - front - middle }
  }
  // Share the depth above the minimums in proportion to each band's rooms.
  const spare = available - minTotal
  const totalWeight = BANDS.reduce((s, b) => s + weight[b], 0) || 1
  const front = snap(minimum.front + (spare * weight.front) / totalWeight)
  const middle = snap(minimum.middle + (spare * weight.middle) / totalWeight)
  return { front, middle, passage: passageDepth, rear: available - front - middle }
}

/** Places one floor's rooms in road space, band by band, inside the house's footprint. */
export function layoutFloor(program: FloorProgram, frame: Frame, depths: BandDepths, variant: LayoutVariant): PlacedRoom[] {
  const inBand = (band: Band) => program.rooms.filter((r) => r.band === band)
  const bandV = { front: 0, middle: depths.front, rear: depths.front + depths.middle + depths.passage }
  const placed = BANDS.flatMap((band) => layoutBand(inBand(band), band, frame.length, bandV[band], depths[band], variant, program.level))
  // The passage connects the rear rooms; only worth building where there are several.
  if (depths.passage > 0 && inBand('rear').length >= 2) {
    placed.push({ key: 'passage', name: 'Passage', type: 'circulation', finish: 'tile', rect: { u: 0, v: depths.front + depths.middle, a: frame.length, d: depths.passage } })
  } else if (depths.passage > 0 && inBand('rear').length === 1) {
    // One rear room: give it the passage depth instead of leaving a gap.
    const rear = placed.filter((p) => p.rect.v >= bandV.rear - 0.01)
    for (const p of rear) if (Math.abs(p.rect.v - bandV.rear) < 0.01) p.rect = { ...p.rect, v: p.rect.v - depths.passage, d: p.rect.d + depths.passage }
  }
  for (const p of placed) {
    const u = variant.mirror ? frame.length - p.rect.u - p.rect.a : p.rect.u
    p.rect = { ...p.rect, u: u + frame.offset }
  }
  return placed
}
