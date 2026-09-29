export type PlotShape = 'rectangular' | 'trapezoidal' | 'irregular'
export type KitchenType = 'open' | 'closed'
export type FamilyType = 'nuclear' | 'joint'
export type DesignStyle =
  | 'modern'
  | 'traditional'
  | 'contemporary'
  | 'kerala'
  | 'rajasthani'
  | 'punjabi'
  | 'south_indian'
export type ExtraRoom = 'home_office' | 'store_room' | 'utility_room' | 'guest_room' | 'servant_quarters' | 'quiet_room'

/**
 * The customer's requirements (project document §6), read by design checks, costing and
 * generation. Mirrors backend app/schemas/brief.py; plot size, facing and budget live on the project.
 */
export interface ProjectBrief {
  plotShape: PlotShape
  /** How a non-rectangular plot differs, since dimensions are still recorded as width × length. */
  plotShapeNotes: string | null
  /** Roads on two sides; affects entrance placement and setbacks. */
  cornerPlot: boolean
  state: string | null
  city: string | null
  /** Width of the road in front, ft; bye-law floor-area and height limits depend on it. */
  roadWidthFt: number | null
  floors: number
  bedrooms: number
  bathrooms: number
  kitchenType: KitchenType
  parkingCars: number
  extraRooms: ExtraRoom[]
  familySize: number
  familyType: FamilyType
  needsGroundFloorBedroom: boolean
  style: DesignStyle
  vastu: boolean
}
