import { intersects, type PlanRoom } from '@/lib/drawings/geometry'
import { FT_PER_M, SQFT_PER_SQM, formatSqft, isBathroom, isKitchen, sqft, type CheckContext } from '../context'
import type { CheckResult } from '../types'

interface Minimum {
  label: string
  areaSqm: number
  widthM: number
}

/**
 * Minimum sizes for residential rooms, following the National Building Code of India 2016, Part 3
 * (habitable room 9.5 m² and 2.4 m wide, a second habitable room 7.5 m² and 2.1 m, kitchen 5.0 m²
 * and 1.8 m, combined bath + WC 2.8 m² and 1.2 m). Local bye-laws can differ; step 5 adds those.
 */
const MAIN_ROOM: Minimum = { label: 'main habitable room', areaSqm: 9.5, widthM: 2.4 }
const OTHER_ROOM: Minimum = { label: 'habitable room', areaSqm: 7.5, widthM: 2.1 }
const KITCHEN: Minimum = { label: 'kitchen', areaSqm: 5.0, widthM: 1.8 }
const BATHROOM: Minimum = { label: 'bath + WC', areaSqm: 2.8, widthM: 1.2 }

function minimumFor(room: PlanRoom, ctx: CheckContext): Minimum | null {
  if (room.type === 'living' || room.id === ctx.masterBedroomId) return MAIN_ROOM
  if (room.type === 'bedroom') return OTHER_ROOM
  if (isKitchen(room)) return KITCHEN
  if (isBathroom(room)) return BATHROOM
  return null
}

const ft = (m: number) => `${(m * FT_PER_M).toFixed(1)} ft`

/** Rooms big enough to use, and not overlapping each other. */
export function spaceChecks(ctx: CheckContext): CheckResult[] {
  const results: CheckResult[] = []
  let checked = 0

  for (const { room, model } of ctx.allRooms) {
    const minimum = minimumFor(room, ctx)
    if (!minimum) continue
    checked++
    const minArea = minimum.areaSqm * SQFT_PER_SQM
    const minWidth = minimum.widthM * FT_PER_M
    const narrow = Math.min(room.width, room.height)
    const problems = [
      sqft(room) < minArea - 0.5 ? `${formatSqft(sqft(room))} (minimum ${formatSqft(minArea)})` : null,
      narrow < minWidth - 0.05 ? `${narrow.toFixed(1)} ft wide (minimum ${ft(minimum.widthM)})` : null,
    ].filter(Boolean)
    if (problems.length === 0) continue
    results.push({
      id: `space-min-${room.id}`,
      category: 'space',
      // Bathrooms below the combined size still work as a separate bath or WC, so they only warn.
      status: isBathroom(room) ? 'warn' : 'fail',
      title: `${room.name} is smaller than a ${minimum.label} should be`,
      detail: problems.join(', and ') + '.',
      roomIds: [room.id],
      floorId: model.floor.id,
    })
  }

  if (checked > 0 && results.length === 0) {
    results.push({ id: 'space-min-all', category: 'space', status: 'pass', title: `All ${checked} main rooms meet the minimum sizes` })
  }

  for (const model of ctx.models) {
    const rooms = model.rooms
    for (let i = 0; i < rooms.length; i++) {
      for (let j = i + 1; j < rooms.length; j++) {
        if (!intersects(rooms[i], rooms[j])) continue
        results.push({
          id: `space-overlap-${rooms[i].id}-${rooms[j].id}`,
          category: 'space',
          status: 'fail',
          title: `${rooms[i].name} overlaps ${rooms[j].name}`,
          detail: `On ${model.floor.name}. Move one so they only share a wall.`,
          roomIds: [rooms[i].id, rooms[j].id],
          floorId: model.floor.id,
          weight: 2,
        })
      }
    }
  }

  return results
}
