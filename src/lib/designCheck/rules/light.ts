import type { FloorModel, PlanRoom, Side } from '@/lib/drawings/geometry'
import { isBathroom, isHabitable, type CheckContext } from '../context'
import type { CheckResult } from '../types'

/** Compass sides on which a room has an exterior wall (where a window or ventilator can go). */
export function exteriorSides(room: PlanRoom, model: FloorModel): Set<Side> {
  return new Set(
    model.walls
      .filter((wall) => wall.exterior && wall.outside && wall.roomIds.includes(room.id))
      .map((wall) => wall.outside as Side),
  )
}

/** Natural light and cross-ventilation, applied the same way to every plan (document §8). */
export function lightChecks(ctx: CheckContext): CheckResult[] {
  const results: CheckResult[] = []
  let habitable = 0
  let crossVentilated = 0

  for (const { room, model } of ctx.allRooms) {
    const sides = exteriorSides(room, model)
    if (isHabitable(room)) {
      habitable++
      if (sides.size === 0) {
        results.push({
          id: `light-none-${room.id}`,
          category: 'light',
          status: 'fail',
          title: `${room.name} has no outside wall`,
          detail: 'Without an outside wall it can’t have a window for daylight or fresh air.',
          roomIds: [room.id],
          floorId: model.floor.id,
          weight: 2,
        })
      } else if (sides.size >= 2) {
        crossVentilated++
      } else if (room.type === 'living') {
        results.push({
          id: `light-cross-${room.id}`,
          category: 'light',
          status: 'warn',
          title: `${room.name} gets air from one side only`,
          detail: 'Windows on two sides give cross-ventilation. Move it to a corner or add a second outside wall.',
          roomIds: [room.id],
          floorId: model.floor.id,
        })
      }
    } else if (isBathroom(room) && sides.size === 0) {
      results.push({
        id: `light-bath-${room.id}`,
        category: 'light',
        status: 'warn',
        title: `${room.name} has no outside wall for a ventilator`,
        detail: 'It will need a ventilation shaft or an exhaust fan.',
        roomIds: [room.id],
        floorId: model.floor.id,
      })
    }
  }

  if (habitable > 0) {
    const share = crossVentilated / habitable
    results.push({
      id: 'light-cross-share',
      category: 'light',
      status: share >= 0.5 ? 'pass' : 'warn',
      title: `${crossVentilated} of ${habitable} bedrooms, living rooms and kitchens have windows on two sides`,
      detail: share >= 0.5 ? undefined : 'Aim for at least half, for cross-ventilation through the house.',
    })
    if (!results.some((r) => r.id.startsWith('light-none-'))) {
      results.push({ id: 'light-all-outside', category: 'light', status: 'pass', title: 'Every bedroom, living room and kitchen has an outside wall' })
    }
  }

  return results
}
