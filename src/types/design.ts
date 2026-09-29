export type RoomType =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'wet'
  | 'pooja'
  | 'utility'
  | 'circulation'

export const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  living: 'Living Room',
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  wet: 'Bathroom',
  pooja: 'Pooja Room',
  utility: 'Utility / Store',
  circulation: 'Foyer / Passage',
}

export interface Room {
  id: string
  name: string
  type: RoomType
  /** Feet, plot-relative: x=0 is the west edge, y=0 is the north edge. */
  x: number
  y: number
  width: number
  height: number
}

export interface Plot {
  width: number
  height: number
  facing: 'north' | 'south' | 'east' | 'west'
}
