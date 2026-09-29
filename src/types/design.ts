export type RoomType =
  | 'living'
  | 'bedroom'
  | 'kitchen'
  | 'wet'
  | 'pooja'
  | 'utility'
  | 'circulation'

export type FloorFinish = 'tile' | 'marble' | 'wood' | 'carpet' | 'concrete'

export type LengthUnit = 'ft' | 'm'

export interface Room {
  id: string
  name: string
  type: RoomType
  /** Feet, plot-relative: x=0 is the west edge, y=0 is the north edge. */
  x: number
  y: number
  width: number
  height: number
  /** Degrees, clockwise, 0-359. */
  rotation: number
  /** Feet, floor to ceiling. */
  wallHeight: number
  /** Feet, floor offset from ground level — lets rooms sit on a different level/plinth. */
  elevation: number
  /** Hex color overriding the room type's default palette; null uses the type default. */
  color: string | null
  floorFinish: FloorFinish
  /** Prevents drag/resize/rotate from the canvas. */
  locked: boolean
  visible: boolean
  /** Overrides the label painted on the canvas; null falls back to `name`. */
  label: string | null
  notes: string
}

/** The subset of Room the backend persists; everything else is filled with client defaults on load. */
export type RoomRecord = Pick<Room, 'id' | 'name' | 'type' | 'x' | 'y' | 'width' | 'height'>

export interface Setbacks {
  front: number
  rear: number
  left: number
  right: number
}

export interface Plot {
  width: number
  height: number
  facing: 'north' | 'south' | 'east' | 'west'
  units: LengthUnit
  setbacks: Setbacks
}

export interface Guides {
  vertical: number[]
  horizontal: number[]
}

/** Structural shape required by useSnapDrag — Room and Furniture both satisfy this. */
export interface PlacedRect {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  locked: boolean
}

export type WallType = 'exterior' | 'partition' | 'compound'

/** Derived from room adjacency, not stored directly — see lib/walls.ts (Milestone 3). */
export interface Wall {
  id: string
  floorId: string
  /** Centerline, feet, floor-relative. */
  x1: number
  y1: number
  x2: number
  y2: number
  thickness: number
  baseElevation: number
  height: number
  type: WallType
  /** The 1 or 2 rooms this wall borders. */
  roomIds: string[]
}

export interface WallOverride {
  thickness?: number
  type?: WallType
}

export type OpeningKind = 'door' | 'window'

/** A door or window embedded in a wall (Milestone 4). */
export interface Opening {
  id: string
  floorId: string
  wallId: string
  kind: OpeningKind
  /** Feet, distance along the wall from its (x1,y1) start point. */
  offset: number
  width: number
  doorHeight?: number
  hinge?: 'start' | 'end'
  swingInto?: 1 | -1
  sillHeight?: number
  windowHeight?: number
}

export type FurnitureType =
  | 'bed'
  | 'sofa'
  | 'dining-table'
  | 'wardrobe'
  | 'kitchen-counter'
  | 'tv-unit'
  | 'washbasin'
  | 'wc'
  | 'shower'
  | 'custom'

/** A draggable furniture item (Milestone 5) — deliberately shares Room's geometry shape. */
export interface Furniture {
  id: string
  floorId: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  locked: boolean
  visible: boolean
  type: FurnitureType
  name: string
  elevation: number
  /** 3D box height — named distinctly from footprint `height`. */
  verticalHeight: number
  color: string | null
  notes: string
}

export type StairShape = 'straight' | 'l-shaped' | 'u-shaped' | 'dog-leg' | 'spiral' | 'winder'

/** A parametric staircase connecting two floors (Milestone 6). */
export interface Staircase {
  id: string
  /** The lower floor it starts on. */
  floorId: string
  /** The floor it lands on. */
  targetFloorId: string
  x: number
  y: number
  width: number
  rotation: number
  shape: StairShape
  treadCount: number
  treadDepth: number
  riserHeight: number
  direction: 'up' | 'down'
}

export interface Floor {
  id: string
  name: string
  /** 0 = ground, negative = basement — determines stacking order. */
  level: number
  /** Feet, slab height above plot ground level. */
  elevation: number
  rooms: Room[]
  wallOverrides: Record<string, WallOverride>
  openings: Opening[]
  furniture: Furniture[]
  staircases: Staircase[]
  guides: Guides
}

export type SelectionRef = { type: 'room' | 'wall' | 'opening' | 'furniture' | 'staircase'; id: string } | null
