import { center, frontSide, type PlanRoom } from '@/lib/drawings/geometry'
import type { Plot } from '@/types/design'
import { isBathroom, isBedroom, isKitchen, nameMatches, type CheckContext } from '../context'
import type { CheckResult } from '../types'

/** How far back from the road a point is: 0 at the road-side boundary, 1 at the rear boundary. */
export function depthFromRoad(room: PlanRoom, plot: Plot) {
  const { x, y } = center(room)
  switch (frontSide(plot)) {
    case 'N':
      return y / plot.height
    case 'S':
      return 1 - y / plot.height
    case 'W':
      return x / plot.width
    case 'E':
      return 1 - x / plot.width
  }
}

/** Keeps family rooms away from guest and common areas, based on the family composition (document §8). */
export function privacyChecks(ctx: CheckContext): CheckResult[] {
  const results: CheckResult[] = []

  // Ground-floor bedrooms in the third of the plot nearest the road are overlooked and noisy.
  const exposed = (ctx.lowest?.rooms ?? []).filter(
    (room) => isBedroom(room) && !nameMatches(room, 'guest') && depthFromRoad(room, ctx.plot) < 1 / 3,
  )
  const groundBedrooms = (ctx.lowest?.rooms ?? []).filter(isBedroom)
  for (const room of exposed) {
    results.push({
      id: `privacy-front-${room.id}`,
      category: 'privacy',
      status: 'warn',
      title: `${room.name} is at the road side of the house`,
      detail: 'Family bedrooms are more private towards the rear; living and guest rooms suit the front.',
      roomIds: [room.id],
      floorId: ctx.lowest?.floor.id,
    })
  }
  const familyBedrooms = groundBedrooms.filter((room) => !nameMatches(room, 'guest')).length
  const awayFromRoad = familyBedrooms - exposed.length
  if (awayFromRoad > 0) {
    results.push({
      id: 'privacy-front-passed',
      category: 'privacy',
      status: 'pass',
      title:
        exposed.length === 0
          ? 'Ground-floor bedrooms are away from the road side'
          : `${awayFromRoad} of ${familyBedrooms} ground-floor bedrooms are away from the road side`,
      weight: awayFromRoad,
    })
  }

  let sharedWall = false
  for (const model of ctx.models) {
    const byId = new Map(model.rooms.map((room) => [room.id, room]))
    const pairs = new Set<string>()
    for (const wall of model.walls) {
      if (wall.roomIds.length < 2) continue
      const [a, b] = wall.roomIds.map((id) => byId.get(id)!)
      const bath = [a, b].find(isBathroom)
      const kitchen = [a, b].find(isKitchen)
      if (!bath || !kitchen || pairs.has(`${bath.id}|${kitchen.id}`)) continue
      pairs.add(`${bath.id}|${kitchen.id}`)
      sharedWall = true
      results.push({
        id: `privacy-bath-kitchen-${bath.id}-${kitchen.id}`,
        category: 'privacy',
        status: 'warn',
        title: `${bath.name} shares a wall with ${kitchen.name}`,
        detail: 'Keep bathrooms away from where food is cooked; a store or utility room makes a good buffer.',
        roomIds: [bath.id, kitchen.id],
        floorId: model.floor.id,
      })
    }
  }
  if (!sharedWall && ctx.allRooms.some(({ room }) => isKitchen(room))) {
    results.push({ id: 'privacy-bath-kitchen', category: 'privacy', status: 'pass', title: 'No bathroom shares a wall with the kitchen' })
  }

  if (ctx.brief?.familyType === 'joint') {
    const bedrooms = ctx.allRooms.filter(({ room }) => isBedroom(room)).length
    const bathrooms = ctx.allRooms.filter(({ room }) => isBathroom(room)).length
    results.push({
      id: 'privacy-joint-baths',
      category: 'privacy',
      status: bathrooms >= bedrooms ? 'pass' : 'warn',
      title:
        bathrooms >= bedrooms
          ? 'Enough bathrooms for every bedroom in a joint family'
          : `${bathrooms} bathrooms for ${bedrooms} bedrooms in a joint family`,
      detail: bathrooms >= bedrooms ? undefined : 'In a joint family each bedroom ideally has its own attached bathroom.',
    })
  }

  return results
}
