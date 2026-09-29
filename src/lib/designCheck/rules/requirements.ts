import { EXTRA_ROOM_OPTIONS, floorsLabel } from '@/lib/brief'
import type { PlanRoom } from '@/lib/drawings/geometry'
import type { ExtraRoom } from '@/types/brief'
import { formatSqft, isBathroom, isBedroom, isKitchen, isParking, isQuietRoom, nameMatches, sqft, type CheckContext } from '../context'
import type { CheckResult } from '../types'

/** One car space, 2.5 m × 5 m. */
const CAR_SPACE_SQFT = 135

const cars = (n: number) => `${n} car${n === 1 ? '' : 's'}`

const EXTRA_ROOM_MATCHERS: Record<ExtraRoom, (room: PlanRoom) => boolean> = {
  quiet_room: isQuietRoom,
  home_office: (room) => nameMatches(room, 'office'),
  guest_room: (room) => nameMatches(room, 'guest'),
  store_room: (room) => nameMatches(room, 'store'),
  utility_room: (room) => nameMatches(room, 'utility'),
  servant_quarters: (room) => nameMatches(room, 'servant'),
}

function countCheck(id: string, label: string, have: number, want: number, roomIds: string[]): CheckResult {
  return {
    id,
    category: 'requirements',
    status: have >= want ? 'pass' : 'fail',
    title: have >= want ? `${label}: ${have} of ${want}` : `${label}: only ${have} of ${want}`,
    detail: have >= want ? undefined : `The brief asks for ${want}. Add ${want - have} more.`,
    roomIds: have >= want ? undefined : roomIds,
    weight: 2,
  }
}

/** Does the plan provide what the customer's brief asked for? */
export function requirementChecks(ctx: CheckContext): CheckResult[] {
  const { brief } = ctx
  if (!brief) return []
  const rooms = ctx.allRooms.map(({ room }) => room)
  const results: CheckResult[] = []

  const usedFloors = ctx.models.filter((model) => model.rooms.length > 0).length
  results.push({
    id: 'req-floors',
    category: 'requirements',
    status: usedFloors === brief.floors ? 'pass' : usedFloors < brief.floors ? 'fail' : 'warn',
    title:
      usedFloors === brief.floors
        ? `Floors: ${floorsLabel(brief.floors)} as briefed`
        : `Floors: plan has ${usedFloors}, brief asks for ${floorsLabel(brief.floors)}`,
    detail: usedFloors > brief.floors ? 'More floors than briefed will raise the cost.' : undefined,
    weight: 2,
  })

  const bedrooms = rooms.filter(isBedroom)
  results.push(countCheck('req-bedrooms', 'Bedrooms', bedrooms.length, brief.bedrooms, bedrooms.map((r) => r.id)))
  const bathrooms = rooms.filter(isBathroom)
  results.push(countCheck('req-bathrooms', 'Bathrooms', bathrooms.length, brief.bathrooms, bathrooms.map((r) => r.id)))

  const kitchens = rooms.filter(isKitchen)
  if (kitchens.length === 0) {
    results.push({ id: 'req-kitchen', category: 'requirements', status: 'fail', title: 'No kitchen in the plan', weight: 2 })
  } else if (brief.kitchenType === 'open') {
    const kitchenIds = new Set(kitchens.map((k) => k.id))
    const open = ctx.models.some((model) =>
      model.walls.some((wall) => {
        const [a, b] = wall.roomIds
        if (!a || !b) return false
        const pair = [model.rooms.find((r) => r.id === a), model.rooms.find((r) => r.id === b)]
        return pair.some((r) => r && kitchenIds.has(r.id)) && pair.some((r) => r?.type === 'living')
      }),
    )
    results.push({
      id: 'req-kitchen',
      category: 'requirements',
      status: open ? 'pass' : 'warn',
      title: open ? 'Open kitchen next to the living area' : 'Open kitchen asked for, but it isn’t next to the living area',
      detail: open ? undefined : 'An open kitchen needs to share a wall with a living room.',
      roomIds: open ? undefined : kitchens.map((k) => k.id),
    })
  } else {
    results.push({ id: 'req-kitchen', category: 'requirements', status: 'pass', title: 'Kitchen provided' })
  }

  if (brief.parkingCars > 0) {
    const parking = (ctx.lowest?.rooms ?? []).filter(isParking)
    const needed = brief.parkingCars * CAR_SPACE_SQFT
    const provided = parking.reduce((sum, room) => sum + sqft(room), 0)
    results.push({
      id: 'req-parking',
      category: 'requirements',
      status: parking.length === 0 ? 'fail' : provided >= needed ? 'pass' : 'warn',
      title:
        parking.length === 0
          ? `No parking on the ground floor for ${cars(brief.parkingCars)}`
          : provided >= needed
            ? `Parking for ${cars(brief.parkingCars)}`
            : `Parking is ${formatSqft(provided)}; ${cars(brief.parkingCars)} ${brief.parkingCars === 1 ? 'needs' : 'need'} about ${formatSqft(needed)}`,
      detail: parking.length === 0 ? 'Name a ground-floor room "Parking" (or "Garage", "Car porch").' : undefined,
      roomIds: parking.length > 0 && provided < needed ? parking.map((r) => r.id) : undefined,
    })
  }

  for (const extra of brief.extraRooms) {
    const label = EXTRA_ROOM_OPTIONS.find((option) => option.value === extra)?.label ?? extra
    const found = rooms.some(EXTRA_ROOM_MATCHERS[extra])
    results.push({
      id: `req-extra-${extra}`,
      category: 'requirements',
      status: found ? 'pass' : 'warn',
      title: found ? `${label} included` : `${label} is in the brief but not in the plan`,
      detail: found ? undefined : 'Add it, or rename an existing room so it can be recognised.',
    })
  }

  if (brief.needsGroundFloorBedroom) {
    const groundBedrooms = (ctx.lowest?.rooms ?? []).filter(isBedroom)
    results.push({
      id: 'req-ground-bedroom',
      category: 'requirements',
      status: groundBedrooms.length > 0 ? 'pass' : 'fail',
      title: groundBedrooms.length > 0 ? 'Ground-floor bedroom for less-mobile members' : 'No bedroom on the ground floor',
      detail: groundBedrooms.length > 0 ? undefined : 'The brief asks for one, for elderly or less-mobile family members.',
      floorId: ctx.lowest?.floor.id,
      weight: 2,
    })
  }

  return results
}
