import type { DesignStyle, ExtraRoom, FamilyType, KitchenType, PlotShape, ProjectBrief } from '@/types/brief'

/** Same defaults as the backend, for fields the customer hasn't answered yet. */
export const DEFAULT_BRIEF: ProjectBrief = {
  plotShape: 'rectangular',
  plotShapeNotes: null,
  cornerPlot: false,
  state: null,
  city: null,
  floors: 1,
  bedrooms: 2,
  bathrooms: 2,
  kitchenType: 'closed',
  parkingCars: 1,
  extraRooms: [],
  familySize: 4,
  familyType: 'nuclear',
  needsGroundFloorBedroom: false,
  style: 'modern',
  vastu: true,
}

/** Allowed ranges, matching the backend's validation. */
export const BRIEF_LIMITS = {
  floors: { min: 1, max: 4 },
  bedrooms: { min: 1, max: 8 },
  bathrooms: { min: 1, max: 8 },
  parkingCars: { min: 0, max: 3 },
  familySize: { min: 1, max: 30 },
} as const

export const PLOT_SHAPE_OPTIONS: { value: PlotShape; label: string }[] = [
  { value: 'rectangular', label: 'Rectangular' },
  { value: 'trapezoidal', label: 'Trapezoidal' },
  { value: 'irregular', label: 'Irregular' },
]

export const KITCHEN_OPTIONS: { value: KitchenType; label: string }[] = [
  { value: 'closed', label: 'Closed' },
  { value: 'open', label: 'Open' },
]

export const FAMILY_TYPE_OPTIONS: { value: FamilyType; label: string }[] = [
  { value: 'nuclear', label: 'Nuclear family' },
  { value: 'joint', label: 'Joint family' },
]

export const STYLE_OPTIONS: { value: DesignStyle; label: string; group: 'General' | 'Regional' }[] = [
  { value: 'modern', label: 'Modern', group: 'General' },
  { value: 'contemporary', label: 'Contemporary', group: 'General' },
  { value: 'traditional', label: 'Traditional', group: 'General' },
  { value: 'kerala', label: 'Kerala', group: 'Regional' },
  { value: 'rajasthani', label: 'Rajasthani', group: 'Regional' },
  { value: 'punjabi', label: 'Punjabi', group: 'Regional' },
  { value: 'south_indian', label: 'South Indian', group: 'Regional' },
]

export const EXTRA_ROOM_OPTIONS: { value: ExtraRoom; label: string; hint?: string }[] = [
  { value: 'quiet_room', label: 'Personal / quiet room', hint: 'Prayer, meditation, study — use it your way' },
  { value: 'home_office', label: 'Home office' },
  { value: 'guest_room', label: 'Guest room' },
  { value: 'store_room', label: 'Store room' },
  { value: 'utility_room', label: 'Utility room' },
  { value: 'servant_quarters', label: 'Servant quarters' },
]

/** "G", "G+1"… — how Indian drawings and contractors describe storeys. */
export function floorsLabel(floors: number) {
  return floors <= 1 ? 'G' : `G+${floors - 1}`
}

/** One-line summary for cards, e.g. "3 BHK · G+1 · Joint family · Kerala". */
export function describeBrief(brief: ProjectBrief) {
  const style = STYLE_OPTIONS.find((option) => option.value === brief.style)?.label
  const family = brief.familyType === 'joint' ? 'Joint family' : 'Nuclear family'
  return [`${brief.bedrooms} BHK`, floorsLabel(brief.floors), family, style].filter(Boolean).join(' · ')
}

export const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // Union territories
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
]
