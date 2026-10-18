import { EXTERIOR_WALL, requiredSetbacks } from '@/lib/drawings/geometry'
import { formatLength } from '@/lib/units'
import type { Floor, Plot, Room, Setbacks } from '@/types/design'
import type { FixAction } from './types'

/** The plan after a fix, and what changed. */
export interface PlanFix {
  floors: Floor[]
  /** New setback lines for the plot, when the fix raises them to the bye-law minimum. */
  setbacks?: Setbacks
  /** What the fix does, for the button's tooltip and the note after it, e.g. "Moved the house 1.5 ft east". */
  summary: string
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

const MIN_SIDE = 3
const EPS = 0.01
const round = (n: number) => Math.round(n * 100) / 100

const boxOf = (r: Pick<Room, 'x' | 'y' | 'width' | 'height'>): Box => ({ x0: r.x, y0: r.y, x1: r.x + r.width, y1: r.y + r.height })
const withBox = (room: Room, b: Box): Room => ({ ...room, x: round(b.x0), y: round(b.y0), width: round(b.x1 - b.x0), height: round(b.y1 - b.y0) })
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS
const area = (b: Box) => (b.x1 - b.x0) * (b.y1 - b.y0)

/** Where rooms may go: inside the setback lines, leaving room for the outer walls around them. */
function buildable(plot: Plot, setbacks: Setbacks): Box {
  const s = requiredSetbacks({ ...plot, setbacks })
  return { x0: s.W + EXTERIOR_WALL, y0: s.N + EXTERIOR_WALL, x1: plot.width - s.E - EXTERIOR_WALL, y1: plot.height - s.S - EXTERIOR_WALL }
}

function replaceRooms(floors: Floor[], changed: Map<string, Room>): Floor[] {
  return floors.map((floor) =>
    floor.rooms.some((r) => changed.has(r.id)) ? { ...floor, rooms: floor.rooms.map((r) => changed.get(r.id) ?? r) } : floor,
  )
}

const SIDES = ['front', 'rear', 'left', 'right'] as const
const setbacksDiffer = (a: Setbacks, b: Setbacks) => SIDES.some((k) => a[k] !== b[k])
const maxSetbacks = (a: Setbacks, b: Setbacks): Setbacks => ({
  front: Math.max(a.front, b.front),
  rear: Math.max(a.rear, b.rear),
  left: Math.max(a.left, b.left),
  right: Math.max(a.right, b.right),
})

function listNames(names: string[]) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/**
 * Works out the change a fix makes to the plan, or null when it can't be done safely by rule (a locked
 * room is in the way, there's no free space, rooms would get too small); the AI assistant can try those.
 */
export function planFix(action: FixAction, plot: Plot, floors: Floor[]): PlanFix | null {
  switch (action.kind) {
    case 'fit-setbacks':
      return fitSetbacks(plot, floors, action.setbacks, action.prefer)
    case 'separate':
      return separate(plot, floors, action.floorId, action.roomIds)
    case 'grow':
      return grow(plot, floors, action)
  }
}

/**
 * Moves the whole house (every floor, so they stay stacked) inside the setback lines, raising them to
 * `setbacks` first if given; trims rooms only if it doesn't fit. When the house fits inside `prefer` too
 * (the bye-law setbacks) without trimming, it goes there, so the fix doesn't cause a bye-law problem.
 */
function fitSetbacks(plot: Plot, floors: Floor[], setbacks?: Setbacks, prefer?: Setbacks): PlanFix | null {
  const lines = setbacks ?? plot.setbacks
  const placed = (prefer && place(plot, floors, maxSetbacks(prefer, lines), false)) || place(plot, floors, lines, true)
  if (!placed) return null
  const { dx, dy, changed, trimmed } = placed
  const raise = setbacks && setbacksDiffer(setbacks, plot.setbacks) ? setbacks : undefined
  if (changed.size === 0 && !raise) return null

  const ft = (n: number) => formatLength(Math.abs(n), plot.units)
  const moves = [dx !== 0 ? `${ft(dx)} ${dx > 0 ? 'east' : 'west'}` : null, dy !== 0 ? `${ft(dy)} ${dy > 0 ? 'south' : 'north'}` : null].filter(Boolean)
  const parts = [
    raise ? 'Set the setback lines to the bye-law minimum' : null,
    moves.length ? `moved the house ${moves.join(' and ')}` : null,
    trimmed.length ? `trimmed ${listNames(trimmed)} to fit` : null,
  ].filter((p): p is string => !!p)
  const summary = parts.join(', ').replace(/^./, (c) => c.toUpperCase())
  return { floors: replaceRooms(floors, changed), setbacks: raise, summary }
}

/**
 * The house moved inside the given setbacks: the placement that trims the least floor area, or null if
 * none works (a room would get too small or is locked, or trimming isn't allowed and it doesn't fit).
 */
function place(plot: Plot, floors: Floor[], setbacks: Setbacks, allowTrim: boolean) {
  const env = buildable(plot, setbacks)
  const rooms = floors.flatMap((f) => f.rooms)
  const visible = rooms.filter((r) => r.visible)
  if (visible.length === 0) return null
  const house: Box = {
    x0: Math.min(...visible.map((r) => r.x)),
    y0: Math.min(...visible.map((r) => r.y)),
    x1: Math.max(...visible.map((r) => r.x + r.width)),
    y1: Math.max(...visible.map((r) => r.y + r.height)),
  }

  // Along each axis: the shift that brings the house inside or, when it is too big for the space, the
  // shifts that line it up with either edge (rooms past the other edge are then trimmed).
  const shifts = (lo: number, hi: number, min: number, max: number) =>
    hi - lo <= max - min + EPS ? [lo < min ? min - lo : hi > max ? max - hi : 0] : allowTrim ? [min - lo, max - hi] : []

  const attempt = (dx: number, dy: number) => {
    const changed = new Map<string, Room>()
    const trimmed: string[] = []
    let lost = 0
    for (const room of rooms) {
      const b = boxOf(room)
      let next: Box = { x0: b.x0 + dx, y0: b.y0 + dy, x1: b.x1 + dx, y1: b.y1 + dy }
      if (room.visible && (next.x0 < env.x0 - EPS || next.y0 < env.y0 - EPS || next.x1 > env.x1 + EPS || next.y1 > env.y1 + EPS)) {
        const kept = { x0: Math.max(next.x0, env.x0), y0: Math.max(next.y0, env.y0), x1: Math.min(next.x1, env.x1), y1: Math.min(next.y1, env.y1) }
        if (kept.x1 - kept.x0 < MIN_SIDE || kept.y1 - kept.y0 < MIN_SIDE) return null
        lost += area(next) - area(kept)
        next = kept
        trimmed.push(room.name)
      }
      const after = withBox(room, next)
      if (after.x === room.x && after.y === room.y && after.width === room.width && after.height === room.height) continue
      if (room.locked) return null
      changed.set(room.id, after)
    }
    return { dx, dy, changed, trimmed, lost }
  }

  let best: NonNullable<ReturnType<typeof attempt>> | null = null
  for (const dx of shifts(house.x0, house.x1, env.x0, env.x1)) {
    for (const dy of shifts(house.y0, house.y1, env.y0, env.y1)) {
      const result = attempt(round(dx), round(dy))
      if (result && (!best || result.lost < best.lost - EPS)) best = result
    }
  }
  return best
}

/** Trims one of two overlapping rooms back to the other's wall: whichever loses the least floor area, then the smallest share of its own. */
function separate(plot: Plot, floors: Floor[], floorId: string, ids: [string, string]): PlanFix | null {
  const floor = floors.find((f) => f.id === floorId)
  const a = floor?.rooms.find((r) => r.id === ids[0])
  const b = floor?.rooms.find((r) => r.id === ids[1])
  if (!a || !b) return null

  let best: { room: Room; box: Box; lost: number; share: number; other: Room } | null = null
  for (const [room, other] of [
    [a, b],
    [b, a],
  ] as const) {
    if (room.locked) continue
    const t = boxOf(room)
    const o = boxOf(other)
    const options: Box[] = [
      { ...t, x0: o.x1 }, // its west wall moves to the other's east wall
      { ...t, x1: o.x0 },
      { ...t, y0: o.y1 },
      { ...t, y1: o.y0 },
    ]
    for (const box of options) {
      if (box.x1 - box.x0 < MIN_SIDE || box.y1 - box.y0 < MIN_SIDE || overlaps(box, o)) continue
      const lost = area(t) - area(box)
      const share = lost / area(t)
      if (!best || lost < best.lost - EPS || (Math.abs(lost - best.lost) <= EPS && share < best.share)) best = { room, box, lost, share, other }
    }
  }
  if (!best) return null

  const after = withBox(best.room, best.box)
  const size = `${formatLength(after.width, plot.units)} × ${formatLength(after.height, plot.units)}`
  return {
    floors: replaceRooms(floors, new Map([[after.id, after]])),
    summary: `Trimmed ${best.room.name} to ${size} so it only shares a wall with ${best.other.name}`,
  }
}

/** Grows a room into free space on its floor (inside the setback lines) until it is big and wide enough. */
function grow(plot: Plot, floors: Floor[], action: Extract<FixAction, { kind: 'grow' }>): PlanFix | null {
  const floor = floors.find((f) => f.id === action.floorId)
  const room = floor?.rooms.find((r) => r.id === action.roomId)
  if (!floor || !room || room.locked) return null
  const env = buildable(plot, plot.setbacks)
  const start = boxOf(room)
  // A room already past a setback line isn't pulled back here; that's the setback fix's job.
  const bounds: Box = { x0: Math.min(env.x0, start.x0), y0: Math.min(env.y0, start.y0), x1: Math.max(env.x1, start.x1), y1: Math.max(env.y1, start.y1) }
  const others = floor.rooms.filter((r) => r.id !== room.id && r.visible).map(boxOf)
  let box = { ...start }

  /** How far a side can move out before it reaches another room or the buildable edge. */
  const freeSpace = (side: 'west' | 'east' | 'north' | 'south') => {
    const facing = others.filter((o) =>
      side === 'west' || side === 'east' ? o.y0 < box.y1 - EPS && o.y1 > box.y0 + EPS : o.x0 < box.x1 - EPS && o.x1 > box.x0 + EPS,
    )
    switch (side) {
      case 'east':
        return Math.max(0, Math.min(bounds.x1, ...facing.filter((o) => o.x0 >= box.x1 - EPS).map((o) => o.x0)) - box.x1)
      case 'west':
        return Math.max(0, box.x0 - Math.max(bounds.x0, ...facing.filter((o) => o.x1 <= box.x0 + EPS).map((o) => o.x1)))
      case 'south':
        return Math.max(0, Math.min(bounds.y1, ...facing.filter((o) => o.y0 >= box.y1 - EPS).map((o) => o.y0)) - box.y1)
      case 'north':
        return Math.max(0, box.y0 - Math.max(bounds.y0, ...facing.filter((o) => o.y1 <= box.y0 + EPS).map((o) => o.y1)))
    }
  }
  /** Widens (x) or deepens (y) the room by up to `amount`, using the side with more space first; returns what it managed. */
  const extend = (axis: 'x' | 'y', amount: number) => {
    const [low, high] = axis === 'x' ? (['west', 'east'] as const) : (['north', 'south'] as const)
    const sides = [low, high].map((side) => ({ side, free: freeSpace(side) })).sort((p, q) => q.free - p.free)
    let left = amount
    for (const { side, free } of sides) {
      const take = Math.min(left, free)
      if (take <= 0) continue
      if (side === 'west') box = { ...box, x0: box.x0 - take }
      if (side === 'east') box = { ...box, x1: box.x1 + take }
      if (side === 'north') box = { ...box, y0: box.y0 - take }
      if (side === 'south') box = { ...box, y1: box.y1 + take }
      left -= take
    }
    return amount - left
  }

  for (const axis of ['x', 'y'] as const) {
    const size = axis === 'x' ? box.x1 - box.x0 : box.y1 - box.y0
    if (size < action.minWidth - EPS && extend(axis, action.minWidth - size) < action.minWidth - size - EPS) return null
  }
  let short = action.minArea - area(box)
  if (short > 0.5) {
    // The shorter side first, which keeps the room closer to square.
    const axes: ('x' | 'y')[] = box.x1 - box.x0 <= box.y1 - box.y0 ? ['x', 'y'] : ['y', 'x']
    for (const axis of axes) {
      const across = axis === 'x' ? box.y1 - box.y0 : box.x1 - box.x0
      extend(axis, Math.ceil((short / across) * 4) / 4)
      short = action.minArea - area(box)
      if (short <= 0.5) break
    }
    if (short > 0.5) return null
  }

  const after = withBox(room, box)
  if (after.width === room.width && after.height === room.height) return null
  const size = (r: Room) => `${formatLength(r.width, plot.units)} × ${formatLength(r.height, plot.units)}`
  return {
    floors: replaceRooms(floors, new Map([[after.id, after]])),
    summary: `Made ${room.name} ${size(after)} (was ${size(room)}) using free space next to it`,
  }
}
