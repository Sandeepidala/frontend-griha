import type { Furniture, FurnitureType } from '@/types/design'
import {
  type FloorModel,
  type PlanOpening,
  type PlanRoom,
  type Rect,
  type Side,
  OPPOSITE,
  area,
  center,
  containsRect,
  intersects,
  isDoor,
  sideOfWall,
} from './geometry'

export type ItemKind =
  | 'bed'
  | 'side-table'
  | 'wardrobe'
  | 'study'
  | 'sofa'
  | 'armchair'
  | 'coffee-table'
  | 'tv-unit'
  | 'dining'
  | 'counter'
  | 'sink'
  | 'hob'
  | 'fridge'
  | 'wc'
  | 'basin'
  | 'shower'
  | 'pooja-unit'
  | 'shelf'
  | 'shoe-rack'
  | 'vehicle'
  | 'custom'

export interface PlacedItem extends Rect {
  id: string
  roomId: string
  kind: ItemKind
  label: string
  /** The wall the item backs onto — drives symbol orientation. */
  wall: Side
  /** 3D height in feet. */
  verticalHeight: number
  /** True for items the user placed in the editor rather than the auto layout. */
  custom: boolean
}

export const ITEM_HEIGHT: Record<ItemKind, number> = {
  bed: 2,
  'side-table': 2,
  wardrobe: 7,
  study: 2.5,
  sofa: 2.8,
  armchair: 2.8,
  'coffee-table': 1.4,
  'tv-unit': 1.8,
  dining: 2.5,
  counter: 2.8,
  sink: 2.8,
  hob: 2.9,
  fridge: 6,
  wc: 2.6,
  basin: 2.8,
  shower: 0.15,
  'pooja-unit': 5,
  shelf: 7,
  'shoe-rack': 3,
  vehicle: 3.5,
  custom: 2.5,
}

export const ITEM_LABEL: Record<ItemKind, string> = {
  bed: 'Bed',
  'side-table': 'Side table',
  wardrobe: 'Wardrobe',
  study: 'Study table',
  sofa: 'Sofa',
  armchair: 'Armchair',
  'coffee-table': 'Coffee table',
  'tv-unit': 'TV unit',
  dining: 'Dining table',
  counter: 'Kitchen counter',
  sink: 'Sink',
  hob: 'Hob + chimney',
  fridge: 'Refrigerator',
  wc: 'EWC',
  basin: 'Wash basin',
  shower: 'Shower area',
  'pooja-unit': 'Pooja unit',
  shelf: 'Storage shelves',
  'shoe-rack': 'Shoe rack',
  vehicle: 'Two-wheeler bay',
  custom: 'Custom item',
}

const FURNITURE_KIND: Record<FurnitureType, ItemKind> = {
  bed: 'bed',
  sofa: 'sofa',
  'dining-table': 'dining',
  wardrobe: 'wardrobe',
  'kitchen-counter': 'counter',
  'tv-unit': 'tv-unit',
  washbasin: 'basin',
  wc: 'wc',
  shower: 'shower',
  custom: 'custom',
}

export const PLUMBING_FIXTURES: ItemKind[] = ['wc', 'basin', 'shower', 'sink']

interface Ctx {
  room: PlanRoom
  blocked: Rect[]
  windows: Rect[]
  items: PlacedItem[]
  doorSide: Side | null
}

function wallLengthOf(room: Rect, side: Side) {
  return side === 'N' || side === 'S' ? room.width : room.height
}

/** A strip of `length` × `depth` hugging a room wall, `t` feet from the wall's west/north end. */
function strip(room: Rect, side: Side, t: number, length: number, depth: number): Rect {
  switch (side) {
    case 'N':
      return { x: room.x + t, y: room.y, width: length, height: depth }
    case 'S':
      return { x: room.x + t, y: room.y + room.height - depth, width: length, height: depth }
    case 'W':
      return { x: room.x, y: room.y + t, width: depth, height: length }
    case 'E':
      return { x: room.x + room.width - depth, y: room.y + t, width: depth, height: length }
  }
}

type Prefer = 'center' | 'start' | 'end' | number

function fits(ctx: Ctx, rect: Rect, avoidWindows: boolean, ignoreKinds: ItemKind[] = []) {
  if (!containsRect(ctx.room, rect)) return false
  if (ctx.blocked.some((b) => intersects(b, rect))) return false
  if (avoidWindows && ctx.windows.some((w) => intersects(w, rect))) return false
  return !ctx.items.some((item) => !ignoreKinds.includes(item.kind) && intersects(item, rect, 0.05))
}

function placeAlong(
  ctx: Ctx,
  side: Side,
  length: number,
  depth: number,
  prefer: Prefer,
  options: { avoidWindows?: boolean; ignoreKinds?: ItemKind[] } = {},
): Rect | null {
  const wallLen = wallLengthOf(ctx.room, side)
  const max = wallLen - length - 0.1
  if (max < 0.1) return null
  const target =
    typeof prefer === 'number' ? prefer : prefer === 'center' ? (wallLen - length) / 2 : prefer === 'start' ? 0.1 : max
  const positions: number[] = []
  for (let t = 0.1; t <= max + 1e-6; t += 0.25) positions.push(t)
  positions.push(Math.min(max, Math.max(0.1, target)))
  positions.sort((a, b) => Math.abs(a - target) - Math.abs(b - target))
  for (const t of positions) {
    const rect = strip(ctx.room, side, t, length, depth)
    if (fits(ctx, rect, options.avoidWindows ?? false, options.ignoreKinds)) return rect
  }
  return null
}

function placeFree(ctx: Ctx, width: number, height: number): Rect | null {
  const c = center(ctx.room)
  const positions: Rect[] = []
  for (let x = ctx.room.x + 0.5; x + width <= ctx.room.x + ctx.room.width - 0.5; x += 0.5) {
    for (let y = ctx.room.y + 0.5; y + height <= ctx.room.y + ctx.room.height - 0.5; y += 0.5) {
      positions.push({ x, y, width, height })
    }
  }
  positions.sort((a, b) => {
    const da = Math.hypot(a.x + width / 2 - c.x, a.y + height / 2 - c.y)
    const db = Math.hypot(b.x + width / 2 - c.x, b.y + height / 2 - c.y)
    return da - db
  })
  // Leave a walking clearance around free-standing pieces.
  return positions.find((rect) => fits(ctx, rect, false) && !ctx.items.some((i) => intersects(i, rect, 1.5))) ?? null
}

function add(ctx: Ctx, kind: ItemKind, rect: Rect | null, wall: Side, label = ITEM_LABEL[kind]) {
  if (!rect) return null
  const item: PlacedItem = {
    ...rect,
    id: `${ctx.room.id}-${kind}-${ctx.items.length}`,
    roomId: ctx.room.id,
    kind,
    label,
    wall,
    verticalHeight: ITEM_HEIGHT[kind],
    custom: false,
  }
  ctx.items.push(item)
  return item
}

function sidesFrom(back: Side): { back: Side; front: Side; left: Side; right: Side } {
  const order: Side[] = ['N', 'E', 'S', 'W']
  const i = order.indexOf(back)
  return { back, front: OPPOSITE[back], left: order[(i + 1) % 4], right: order[(i + 3) % 4] }
}

/** Along-wall coordinate of the corner that `side` shares with `back`. */
function cornerPrefer(side: Side, back: Side): Prefer {
  if (side === 'N' || side === 'S') return back === 'E' ? 'end' : 'start'
  return back === 'S' ? 'end' : 'start'
}

function doorZones(room: PlanRoom, openings: PlanOpening[]): Rect[] {
  return openings
    .filter((o) => isDoor(o) && o.roomIds.includes(room.id))
    .map((o) => {
      const reach = o.width + 0.25
      const into = sideOfWall(o.wall, room)
      const start = o.center - o.width / 2 - 0.25
      const length = o.width + 0.5
      if (o.wall.orientation === 'h') {
        return { x: start, y: into === 'S' ? o.wall.at : o.wall.at - reach, width: length, height: reach }
      }
      return { x: into === 'E' ? o.wall.at : o.wall.at - reach, y: start, width: reach, height: length }
    })
}

function windowZones(room: PlanRoom, openings: PlanOpening[]): Rect[] {
  return openings
    .filter((o) => !isDoor(o) && o.roomIds.includes(room.id))
    .map((o) => {
      const into = sideOfWall(o.wall, room)
      const start = o.center - o.width / 2
      if (o.wall.orientation === 'h') {
        return { x: start, y: into === 'S' ? o.wall.at : o.wall.at - 2.5, width: o.width, height: 2.5 }
      }
      return { x: into === 'E' ? o.wall.at : o.wall.at - 2.5, y: start, width: 2.5, height: o.width }
    })
}

/** The wall opposite the room's main door — beds, sofas and WCs back onto it. */
export function backWallOf(room: PlanRoom, openings: PlanOpening[]): { back: Side; doorSide: Side | null } {
  const door = openings.find((o) => isDoor(o) && o.roomIds.includes(room.id))
  if (!door) return { back: room.width >= room.height ? 'N' : 'W', doorSide: null }
  const doorSide = OPPOSITE[sideOfWall(door.wall, room)]
  return { back: OPPOSITE[doorSide], doorSide }
}

function tryWalls(sides: Side[], fn: (side: Side) => Rect | null): { rect: Rect; side: Side } | null {
  for (const side of sides) {
    const rect = fn(side)
    if (rect) return { rect, side }
  }
  return null
}

function layoutBedroom(ctx: Ctx, back: Side, isMaster: boolean) {
  const s = sidesFrom(back)
  const bedWidth = isMaster || Math.min(ctx.room.width, ctx.room.height) >= 12 ? 6 : 5
  const bed = tryWalls([s.back, s.left, s.right], (side) => placeAlong(ctx, side, bedWidth, 6.75, 'center'))
  if (bed) {
    const item = add(ctx, 'bed', bed.rect, bed.side)!
    const along = bed.side === 'N' || bed.side === 'S' ? item.x - ctx.room.x : item.y - ctx.room.y
    add(ctx, 'side-table', placeAlong(ctx, bed.side, 1.5, 1.5, along - 1.6), bed.side)
    add(ctx, 'side-table', placeAlong(ctx, bed.side, 1.5, 1.5, along + bedWidth + 0.1), bed.side)
  }
  const wardrobeSides = [s.left, s.right, s.front, s.back].filter((side) => side !== bed?.side)
  const wardrobe = tryWalls(wardrobeSides, (side) => {
    const length = Math.min(7, wallLengthOf(ctx.room, side) - 1.5)
    return length >= 4 ? placeAlong(ctx, side, length, 2, 'center', { avoidWindows: true }) : null
  })
  if (wardrobe) add(ctx, 'wardrobe', wardrobe.rect, wardrobe.side)
  if (area(ctx.room) >= 140) {
    const study = tryWalls(wardrobeSides, (side) => placeAlong(ctx, side, 3.5, 2, 'center'))
    if (study) add(ctx, 'study', study.rect, study.side)
  }
}

function layoutLiving(ctx: Ctx, back: Side) {
  const s = sidesFrom(back)
  const sofa = tryWalls([s.back, s.left, s.right], (side) => placeAlong(ctx, side, 7, 3, 'center'))
  if (sofa) {
    const item = add(ctx, 'sofa', sofa.rect, sofa.side)!
    const out = { N: [0, 1], S: [0, -1], E: [-1, 0], W: [1, 0] }[sofa.side]
    const horizontal = sofa.side === 'N' || sofa.side === 'S'
    const table: Rect = horizontal
      ? { x: item.x + 1.75, y: out[1] > 0 ? item.y + 4.5 : item.y - 3.5, width: 3.5, height: 2 }
      : { x: out[0] > 0 ? item.x + 4.5 : item.x - 3.5, y: item.y + 1.75, width: 2, height: 3.5 }
    if (fits(ctx, table, false)) add(ctx, 'coffee-table', table, sofa.side)
    const tvSide = OPPOSITE[sofa.side]
    const tv = placeAlong(ctx, tvSide, 6, 1.5, 'center')
    if (tv) add(ctx, 'tv-unit', tv, tvSide)
    const chairsSides: Side[] = horizontal ? ['W', 'E'] : ['N', 'S']
    for (const side of chairsSides) add(ctx, 'armchair', placeAlong(ctx, side, 2.5, 2.5, 'center'), side)
  }
  if (area(ctx.room) >= 190) {
    const dining = placeFree(ctx, 5, 3)
    if (dining) add(ctx, 'dining', dining, 'N', 'Dining (6 seater)')
  }
}

function layoutKitchen(ctx: Ctx, back: Side) {
  const s = sidesFrom(back)
  const depth = 2
  const counters: { rect: Rect; side: Side }[] = []
  // Longest counter run that clears the door swings: try the back wall first, then the sides.
  const longest = (side: Side, max: number, prefer: Prefer, ignore: ItemKind[] = []) => {
    for (let length = max; length >= 4; length -= 0.5) {
      const rect = placeAlong(ctx, side, length, depth, prefer, { ignoreKinds: ignore })
      if (rect) return rect
    }
    return null
  }
  const main = tryWalls([s.back, s.left, s.right], (side) => longest(side, wallLengthOf(ctx.room, side) - 0.2, 'center'))
  if (main) {
    add(ctx, 'counter', main.rect, main.side)
    counters.push(main)
    const back = main.side
    for (const side of [sidesFrom(back).left, sidesFrom(back).right]) {
      const rect = longest(side, Math.min(8, wallLengthOf(ctx.room, side) - 4), cornerPrefer(side, back), ['counter'])
      if (rect) {
        add(ctx, 'counter', rect, side)
        counters.push({ rect, side })
        break
      }
    }
  }
  const run = counters[0]
  if (run) {
    const main = run
    const horizontal = main.side === 'N' || main.side === 'S'
    const along = horizontal ? main.rect.width : main.rect.height
    const at = (t: number, len: number): Rect =>
      horizontal
        ? { x: main.rect.x + t, y: main.rect.y + 0.2, width: len, height: 1.6 }
        : { x: main.rect.x + 0.2, y: main.rect.y + t, width: 1.6, height: len }
    const window = ctx.windows.find((w) => intersects(w, main.rect))
    let sinkT = along * 0.3
    if (window) sinkT = horizontal ? window.x + window.width / 2 - main.rect.x - 1.25 : window.y + window.height / 2 - main.rect.y - 1.25
    sinkT = Math.min(Math.max(0.5, sinkT), along - 3)
    ctx.items.push({ ...at(sinkT, 2.5), id: `${ctx.room.id}-sink`, roomId: ctx.room.id, kind: 'sink', label: ITEM_LABEL.sink, wall: main.side, verticalHeight: ITEM_HEIGHT.sink, custom: false })
    const hobT = sinkT < along / 2 ? Math.max(sinkT + 3.5, along * 0.62) : Math.min(sinkT - 3.5, along * 0.2)
    if (hobT >= 0.3 && hobT + 2.5 <= along - 0.3) {
      ctx.items.push({ ...at(hobT, 2.5), id: `${ctx.room.id}-hob`, roomId: ctx.room.id, kind: 'hob', label: ITEM_LABEL.hob, wall: main.side, verticalHeight: ITEM_HEIGHT.hob, custom: false })
    }
  }
  const fridge = tryWalls([s.left, s.right, s.front], (side) => placeAlong(ctx, side, 2.5, 2.5, 'center', { avoidWindows: true }))
  if (fridge) add(ctx, 'fridge', fridge.rect, fridge.side)
  if (Math.min(ctx.room.width, ctx.room.height) >= 11) {
    const dining = placeFree(ctx, 4, 3)
    if (dining) add(ctx, 'dining', dining, 'N', 'Dining (4 seater)')
  }
}

function layoutWet(ctx: Ctx, back: Side) {
  const s = sidesFrom(back)
  const order = [s.back, s.left, s.right, s.front]
  const shower = tryWalls(order, (side) => placeAlong(ctx, side, 3, 3, 'end'))
  if (shower) add(ctx, 'shower', shower.rect, shower.side)
  const wc = tryWalls(order, (side) => placeAlong(ctx, side, 2, 2.4, 'start'))
  if (wc) add(ctx, 'wc', wc.rect, wc.side)
  const basin = tryWalls([s.left, s.right, s.back, s.front], (side) => placeAlong(ctx, side, 2, 1.5, 'center'))
  if (basin) add(ctx, 'basin', basin.rect, basin.side)
}

function layoutUtility(ctx: Ctx, back: Side) {
  const s = sidesFrom(back)
  if (/park|garage|car/i.test(ctx.room.name)) {
    const bays = Math.max(1, Math.min(3, Math.floor((wallLengthOf(ctx.room, s.back) - 1) / 3)))
    for (let i = 0; i < bays; i++) add(ctx, 'vehicle', placeAlong(ctx, s.back, 2.5, 6.5, 'start'), s.back)
    return
  }
  for (const side of [s.back, s.left, s.right]) {
    const length = wallLengthOf(ctx.room, side) - 1
    if (length >= 3) add(ctx, 'shelf', placeAlong(ctx, side, length, 1.5, 'center'), side)
  }
}

function layoutRoom(ctx: Ctx, openings: PlanOpening[]) {
  const { back } = backWallOf(ctx.room, openings)
  switch (ctx.room.type) {
    case 'bedroom':
      layoutBedroom(ctx, back, /master/i.test(ctx.room.name))
      break
    case 'living':
      layoutLiving(ctx, back)
      break
    case 'kitchen':
      layoutKitchen(ctx, back)
      break
    case 'wet':
      layoutWet(ctx, back)
      break
    case 'pooja': {
      const east = placeAlong(ctx, 'E', Math.min(3, ctx.room.height - 1), 1.5, 'center')
      if (east) add(ctx, 'pooja-unit', east, 'E')
      else add(ctx, 'pooja-unit', placeAlong(ctx, back, 3, 1.5, 'center'), back)
      break
    }
    case 'utility':
      layoutUtility(ctx, back)
      break
    case 'circulation':
      add(ctx, 'shoe-rack', placeAlong(ctx, sidesFrom(back).left, 3, 1.25, 'center') ?? placeAlong(ctx, back, 3, 1.25, 'center'), sidesFrom(back).left)
      break
  }
}

/**
 * Furniture & fixture layout for a floor. Rooms containing furniture placed in the editor keep
 * exactly that furniture; every other room gets an auto layout that avoids door swings.
 */
export function layoutFloor(model: FloorModel): PlacedItem[] {
  const custom = model.floor.furniture.filter((f) => f.visible).map((f) => toPlacedItem(f, model.rooms))
  const roomsWithCustom = new Set(custom.map((c) => c.roomId))
  const items: PlacedItem[] = [...custom]
  for (const room of model.rooms) {
    if (roomsWithCustom.has(room.id)) continue
    const ctx: Ctx = {
      room,
      blocked: doorZones(room, model.openings),
      windows: windowZones(room, model.openings),
      items: [],
      doorSide: backWallOf(room, model.openings).doorSide,
    }
    layoutRoom(ctx, model.openings)
    items.push(...ctx.items)
  }
  return items
}

function toPlacedItem(furniture: Furniture, rooms: PlanRoom[]): PlacedItem {
  const c = { x: furniture.x + furniture.width / 2, y: furniture.y + furniture.height / 2 }
  const room = rooms.find((r) => c.x >= r.x && c.x <= r.x + r.width && c.y >= r.y && c.y <= r.y + r.height)
  const kind = FURNITURE_KIND[furniture.type]
  return {
    id: furniture.id,
    roomId: room?.id ?? '',
    kind,
    label: furniture.name || ITEM_LABEL[kind],
    x: furniture.x,
    y: furniture.y,
    width: furniture.width,
    height: furniture.height,
    wall: 'N',
    verticalHeight: furniture.verticalHeight,
    custom: true,
  }
}

// ---------------------------------------------------------------------------------------------
// Reflected ceiling
// ---------------------------------------------------------------------------------------------

export type CeilingKind = 'peripheral' | 'flat' | 'grid' | 'feature' | 'exposed'

export interface CeilingZone {
  roomId: string
  kind: CeilingKind
  /** Outer false-ceiling level above FFL, feet. */
  level: number
  /** For peripheral/feature ceilings: the raised central recess. */
  recess: Rect | null
  recessLevel: number | null
  material: string
  downlights: { x: number; y: number }[]
  coveLight: boolean
}

export function ceilingPlan(model: FloorModel): CeilingZone[] {
  return model.rooms.map((room) => {
    const slab = room.room.wallHeight
    const base = { roomId: room.id, downlights: [] as { x: number; y: number }[], coveLight: false, recess: null, recessLevel: null }
    switch (room.type) {
      case 'living':
      case 'bedroom': {
        const band = Math.min(2, Math.min(room.width, room.height) / 5)
        const recess = { x: room.x + band, y: room.y + band, width: room.width - band * 2, height: room.height - band * 2 }
        const downlights: { x: number; y: number }[] = []
        const inset = band / 2
        const perimeter = [
          { x0: room.x + inset, y0: room.y + inset, x1: room.x + room.width - inset, y1: room.y + inset },
          { x0: room.x + inset, y0: room.y + room.height - inset, x1: room.x + room.width - inset, y1: room.y + room.height - inset },
        ]
        for (const edge of perimeter) {
          const n = Math.max(2, Math.round((edge.x1 - edge.x0) / 4) + 1)
          for (let i = 0; i < n; i++) downlights.push({ x: edge.x0 + ((edge.x1 - edge.x0) * i) / (n - 1), y: edge.y0 })
        }
        return {
          ...base,
          kind: 'peripheral' as const,
          level: slab - 1,
          recess,
          recessLevel: slab - 0.5,
          material: '12.5mm gypsum board on GI frame, POP punning',
          downlights,
          coveLight: true,
        }
      }
      case 'kitchen':
      case 'circulation': {
        const downlights: { x: number; y: number }[] = []
        const cols = Math.max(1, Math.round(room.width / 5))
        const rows = Math.max(1, Math.round(room.height / 5))
        for (let i = 0; i < cols; i++)
          for (let j = 0; j < rows; j++)
            downlights.push({ x: room.x + (room.width * (i + 0.5)) / cols, y: room.y + (room.height * (j + 0.5)) / rows })
        return {
          ...base,
          kind: 'flat' as const,
          level: slab - 1,
          material: room.type === 'kitchen' ? 'Moisture-resistant gypsum board, flat' : '12.5mm gypsum board, flat',
          downlights,
        }
      }
      case 'wet':
        return { ...base, kind: 'grid' as const, level: Math.min(8, slab - 1), material: '2\'×2\' PVC grid ceiling (access to plumbing)', downlights: [center(room)] }
      case 'pooja': {
        const size = Math.min(room.width, room.height) * 0.6
        const c = center(room)
        return {
          ...base,
          kind: 'feature' as const,
          level: slab - 0.75,
          recess: { x: c.x - size / 2, y: c.y - size / 2, width: size, height: size },
          recessLevel: slab - 0.25,
          material: 'Gypsum dome feature with concealed cove',
          downlights: [c],
          coveLight: true,
        }
      }
      default:
        return { ...base, kind: 'exposed' as const, level: slab, material: 'Exposed RCC slab, putty + paint', downlights: [center(room)] }
    }
  })
}
