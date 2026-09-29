import type { ProjectBrief } from '@/types/brief'
import type { FloorFinish, RoomType } from '@/types/design'

/** Bands from the road side back: public rooms at the front, service in the middle, private at the rear. */
export type Band = 'front' | 'middle' | 'rear'

export interface ProgramRoom {
  /** Unique within the floor, stable across variants (used for room ids). */
  key: string
  name: string
  type: RoomType
  /** Target floor area, sq ft; rooms in a band share its width in proportion to this. */
  area: number
  band: Band
  finish: FloorFinish
  /** Fixed width along the road (parking, stairs, foyer): kept whatever the band's size. */
  fixedWidth?: number
  role?: 'parking' | 'stair' | 'foyer'
  /** Rooms the layout may move to another band when this one runs out of width. */
  movable?: boolean
  /** A bedroom's attached bathroom, laid out beside it as a suite. */
  attachedBath?: { key: string; name: string; area: number }
}

export interface FloorProgram {
  level: number
  name: string
  rooms: ProgramRoom[]
}

/** Choices a generated option makes about the programme; each variant is scored and the best kept. */
export interface ProgramVariant {
  kitchenBand: Band
  quietRoomBand: Band
  /** Car parking perpendicular to the road (9 ft wide, 17 ft deep per car) or parallel to it. */
  parking: 'perpendicular' | 'parallel'
}

/** Typical target sizes, sq ft; the layout scales each band to fit the plot. */
export const TARGET_AREA = {
  living: 200,
  lounge: 150,
  kitchen: 110,
  quiet: 45,
  master: 170,
  bedroom: 140,
  guest: 130,
  attachedBath: 45,
  commonBath: 40,
  store: 40,
  utility: 40,
  office: 90,
  servant: 90,
} as const

export const CAR_WIDTH = 9
export const CAR_LENGTH = 17
/** A dog-leg stair of two 3.5 ft flights with its landing, as the structural sheet designs it. */
export const STAIR_WIDTH = 7.5
export const STAIR_DEPTH = 10.5
export const FOYER_WIDTH = 5.5
export const PASSAGE_DEPTH = 3.5
/** A bedroom with its attached bathroom and dress, as laid out. */
const SUITE_AREA = TARGET_AREA.bedroom + TARGET_AREA.attachedBath + 15

export const FLOOR_NAMES = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor']

export function parkingSize(cars: number, parking: ProgramVariant['parking']) {
  return parking === 'parallel' ? { width: cars * CAR_LENGTH, depth: CAR_WIDTH } : { width: cars * CAR_WIDTH, depth: CAR_LENGTH }
}

/** Floor area the ground floor needs before any bedrooms: parking, living, kitchen, extras, stairs. */
function groundFixedArea(brief: ProjectBrief) {
  const extra = { quiet_room: TARGET_AREA.quiet, guest_room: TARGET_AREA.guest, store_room: TARGET_AREA.store, utility_room: TARGET_AREA.utility, servant_quarters: TARGET_AREA.servant, home_office: brief.floors > 1 ? 0 : TARGET_AREA.office }
  return (
    brief.parkingCars * CAR_WIDTH * CAR_LENGTH +
    FOYER_WIDTH * 10 +
    TARGET_AREA.living +
    TARGET_AREA.kitchen +
    brief.extraRooms.reduce((s, r) => s + extra[r], 0) +
    (brief.floors > 1 ? STAIR_WIDTH * STAIR_DEPTH : 0)
  )
}

/**
 * Bedrooms per floor: upper floors take as many as fit (they have no living rooms or parking),
 * the ground floor the rest, and at least one when the brief needs a ground-floor bedroom.
 */
export function bedroomsPerFloor(brief: ProjectBrief, floorArea: number, passageArea: number): number[] {
  if (brief.floors === 1) return [brief.bedrooms]
  const upperCapacity = Math.max(1, Math.floor((floorArea - STAIR_WIDTH * STAIR_DEPTH - passageArea) / SUITE_AREA))
  const groundCapacity = Math.max(0, Math.floor((floorArea - groundFixedArea(brief) - passageArea) / SUITE_AREA))
  const counts = Array(brief.floors).fill(0)
  let remaining = brief.bedrooms
  counts[0] = Math.min(remaining, Math.max(brief.needsGroundFloorBedroom ? 1 : 0, 0))
  remaining -= counts[0]
  // Fill upper floors evenly up to their capacity, then put what's left on the ground floor.
  const uppers = brief.floors - 1
  for (let f = 1; f <= uppers && remaining > 0; f++) {
    const share = Math.min(upperCapacity, Math.ceil(remaining / (uppers - f + 1)))
    counts[f] = share
    remaining -= share
  }
  const extraGround = Math.min(remaining, Math.max(0, groundCapacity - counts[0]))
  counts[0] += extraGround
  remaining -= extraGround
  // Whatever still doesn't fit goes where the rooms will be least cramped: spread over the upper floors.
  for (let f = 1; remaining > 0; f = (f % uppers) + 1) {
    counts[f]++
    remaining--
  }
  return counts
}

/** The rooms each floor needs, from the customer's brief (project document §6). */
export function buildProgram(brief: ProjectBrief, variant: ProgramVariant, floorArea: number, passageArea: number): FloorProgram[] {
  const perFloor = bedroomsPerFloor(brief, floorArea, passageArea)
  const multi = brief.floors > 1
  let bathsLeft = brief.bathrooms
  let bedroomNo = 0
  let bathNo = 0
  const bathName = () => `Bathroom ${++bathNo}`

  // Bathrooms: the ground floor gets a common one when it has no bedroom to attach it to;
  // then every bedroom gets an attached bathroom while they last, master first.
  const groundCommonBath = perFloor[0] === 0 && bathsLeft > 0
  if (groundCommonBath) bathsLeft--

  const programs: FloorProgram[] = []
  for (let level = 0; level < brief.floors; level++) {
    const rooms: ProgramRoom[] = []
    const add = (room: ProgramRoom) => rooms.push(room)

    if (multi) add({ key: 'stair', name: 'Staircase', type: 'circulation', area: STAIR_WIDTH * STAIR_DEPTH, band: 'middle', finish: 'tile', fixedWidth: STAIR_WIDTH, role: 'stair' })

    if (level === 0) {
      if (brief.parkingCars > 0) {
        const { width, depth } = parkingSize(brief.parkingCars, variant.parking)
        add({ key: 'parking', name: 'Parking', type: 'utility', area: width * depth, band: 'front', finish: 'concrete', fixedWidth: width, role: 'parking' })
      }
      add({ key: 'foyer', name: 'Foyer', type: 'circulation', area: FOYER_WIDTH * 10, band: 'front', finish: 'tile', fixedWidth: FOYER_WIDTH, role: 'foyer' })
      // Movable last: it only leaves the front when parking and the foyer take the whole width.
      add({ key: 'living', name: 'Living Room', type: 'living', area: TARGET_AREA.living, band: 'front', finish: 'tile', movable: true })
      add({ key: 'kitchen', name: 'Kitchen', type: 'kitchen', area: TARGET_AREA.kitchen, band: variant.kitchenBand, finish: 'tile', movable: true })
      const extra = (key: string, name: string, type: RoomType, area: number, band: Band, finish: FloorFinish = 'tile') =>
        add({ key, name, type, area, band, finish, movable: true })
      if (brief.extraRooms.includes('quiet_room')) extra('quiet', 'Quiet Room', 'pooja', TARGET_AREA.quiet, variant.quietRoomBand, 'marble')
      if (brief.extraRooms.includes('guest_room')) extra('guest', 'Guest Room', 'bedroom', TARGET_AREA.guest, 'middle')
      if (brief.extraRooms.includes('store_room')) extra('store', 'Store Room', 'utility', TARGET_AREA.store, 'middle')
      if (brief.extraRooms.includes('utility_room')) extra('utility', 'Utility', 'utility', TARGET_AREA.utility, 'middle')
      if (brief.extraRooms.includes('servant_quarters')) extra('servant', 'Servant Quarters', 'utility', TARGET_AREA.servant, 'rear')
      if (brief.extraRooms.includes('home_office') && !multi) extra('office', 'Home Office', 'utility', TARGET_AREA.office, 'middle')
      if (groundCommonBath) extra('bath-common', bathName(), 'wet', TARGET_AREA.commonBath, 'middle')
    }

    // Upper floors use the front band for bedrooms too; on the ground floor they stay at the rear.
    for (let i = 0; i < perFloor[level]; i++) {
      bedroomNo++
      const master = bedroomNo === 1
      const bath = bathsLeft > 0 ? (bathsLeft--, { key: `bath-${bedroomNo}`, name: bathName(), area: TARGET_AREA.attachedBath }) : undefined
      add({
        key: `bed-${bedroomNo}`,
        name: master ? 'Master Bedroom' : `Bedroom ${bedroomNo}`,
        type: 'bedroom',
        area: master ? TARGET_AREA.master : TARGET_AREA.bedroom,
        band: level > 0 && i % 2 === 1 ? 'front' : 'rear',
        finish: 'tile',
        attachedBath: bath,
      })
    }

    if (level === 1) {
      const used = rooms.reduce((s, r) => s + r.area + (r.attachedBath ? r.attachedBath.area + 15 : 0), 0) + passageArea
      if (brief.extraRooms.includes('home_office')) add({ key: 'office', name: 'Home Office', type: 'utility', area: TARGET_AREA.office, band: 'middle', finish: 'tile', movable: true })
      // A family lounge upstairs only when there's room for it; the brief doesn't ask for one.
      if (floorArea - used >= TARGET_AREA.lounge) add({ key: 'lounge', name: 'Family Lounge', type: 'living', area: TARGET_AREA.lounge, band: 'middle', finish: 'tile', movable: true })
    }

    programs.push({ level, name: FLOOR_NAMES[level] ?? `Floor ${level + 1}`, rooms })
  }

  // Any bathrooms left over become common ones, ground floor first.
  for (let level = 0; bathsLeft > 0; level = (level + 1) % programs.length) {
    programs[level].rooms.push({ key: `bath-extra-${bathsLeft}`, name: bathName(), type: 'wet', area: TARGET_AREA.commonBath, band: 'middle', finish: 'tile', movable: true })
    bathsLeft--
  }

  return programs
}

/** Floor area the brief asks for on its busiest floor, to warn when the plot can't hold it. */
export function programAreaPerFloor(programs: FloorProgram[]) {
  return Math.max(...programs.map((p) => p.rooms.reduce((s, r) => s + r.area + (r.attachedBath ? r.attachedBath.area + 15 : 0), 0)))
}
