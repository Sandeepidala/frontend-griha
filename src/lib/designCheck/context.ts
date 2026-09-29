import { buildBuildingModel, center, unionRect, type FloorModel, type PlanRoom, type Point, type Rect } from '@/lib/drawings/geometry'
import type { DesignCheckInput } from './types'

/**
 * Compass zones of a 3 × 3 grid over an area: the building's footprint for room placement, as Vastu is
 * usually applied to the house itself. The plan is always north-up: y = 0 is the north edge.
 */
export type Zone = 'NW' | 'N' | 'NE' | 'W' | 'C' | 'E' | 'SW' | 'S' | 'SE'

export const ZONE_LABELS: Record<Zone, string> = {
  NW: 'north-west',
  N: 'north',
  NE: 'north-east',
  W: 'west',
  C: 'centre',
  E: 'east',
  SW: 'south-west',
  S: 'south',
  SE: 'south-east',
}

export function zoneOf(point: Point, area: { x?: number; y?: number; width: number; height: number }): Zone {
  const col = Math.min(2, Math.max(0, Math.floor(((point.x - (area.x ?? 0)) / area.width) * 3)))
  const row = Math.min(2, Math.max(0, Math.floor(((point.y - (area.y ?? 0)) / area.height) * 3)))
  const grid: Zone[][] = [
    ['NW', 'N', 'NE'],
    ['W', 'C', 'E'],
    ['SW', 'S', 'SE'],
  ]
  return grid[row][col]
}

export function roomZone(room: PlanRoom, area: { x?: number; y?: number; width: number; height: number }): Zone {
  return zoneOf(center(room), area)
}

// Extra rooms are recognised by type or by name, since the editor's room types are broad.
const NAME_PATTERNS = {
  parking: /parking|garage|car\s*porch|carport/i,
  master: /master/i,
  guest: /guest/i,
  quiet: /pooja|puja|prayer|quiet|meditation/i,
  office: /office|study/i,
  store: /store/i,
  utility: /utility|wash|laundry/i,
  servant: /servant|staff|maid|help/i,
  entrance: /foyer|entrance|porch|lobby/i,
} as const

export function nameMatches(room: PlanRoom, pattern: keyof typeof NAME_PATTERNS) {
  return NAME_PATTERNS[pattern].test(room.name) || NAME_PATTERNS[pattern].test(room.room.name)
}

export const isBedroom = (room: PlanRoom) => room.type === 'bedroom'
export const isBathroom = (room: PlanRoom) => room.type === 'wet'
export const isKitchen = (room: PlanRoom) => room.type === 'kitchen'
export const isQuietRoom = (room: PlanRoom) => room.type === 'pooja' || nameMatches(room, 'quiet')
export const isParking = (room: PlanRoom) => nameMatches(room, 'parking')
/** Rooms people live in, which need daylight and air: bedrooms, living rooms and kitchens. */
export const isHabitable = (room: PlanRoom) => room.type === 'bedroom' || room.type === 'living' || room.type === 'kitchen'

export interface CheckContext extends DesignCheckInput {
  models: FloorModel[]
  /** Lowest floor first. */
  lowest: FloorModel | null
  allRooms: { room: PlanRoom; model: FloorModel }[]
  /** The master bedroom: named "master", else the largest bedroom in the building. */
  masterBedroomId: string | null
  /** Outline of every room on every floor: the house's footprint, for Vastu zones. */
  building: Rect | null
}

export function buildContext(input: DesignCheckInput): CheckContext {
  const models = buildBuildingModel(input.floors, input.plot)
  const allRooms = models.flatMap((model) => model.rooms.map((room) => ({ room, model })))
  const bedrooms = allRooms.filter(({ room }) => isBedroom(room))
  const master =
    bedrooms.find(({ room }) => nameMatches(room, 'master')) ??
    [...bedrooms].sort((a, b) => b.room.width * b.room.height - a.room.width * a.room.height)[0]
  return {
    ...input,
    models,
    lowest: models[0] ?? null,
    allRooms,
    masterBedroomId: master?.room.id ?? null,
    building: unionRect(allRooms.map(({ room }) => room)),
  }
}

export const SQFT_PER_SQM = 10.7639
export const FT_PER_M = 3.28084

export function sqft(room: { width: number; height: number }) {
  return room.width * room.height
}

export function formatSqft(value: number) {
  return `${Math.round(value)} sq ft`
}
