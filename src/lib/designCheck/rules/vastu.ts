import type { PlanRoom } from '@/lib/drawings/geometry'
import {
  ZONE_LABELS,
  isBathroom,
  isBedroom,
  isKitchen,
  isQuietRoom,
  nameMatches,
  roomZone,
  zoneOf,
  type CheckContext,
  type Zone,
} from '../context'
import type { CheckResult, CheckStatus } from '../types'

interface Placement {
  label: string
  ideal: Zone[]
  acceptable?: Zone[]
  avoid: Zone[]
}

/**
 * Commonly followed Vastu placements, applied the same way to every project that keeps Vastu on.
 * Zones are a 3 × 3 grid over the plot; the centre (Brahmasthan) is kept free of kitchens,
 * bathrooms and stairs.
 */
const KITCHEN: Placement = { label: 'kitchen', ideal: ['SE'], acceptable: ['NW'], avoid: ['NE', 'SW', 'C'] }
const MASTER_BEDROOM: Placement = { label: 'master bedroom', ideal: ['SW'], acceptable: ['S', 'W'], avoid: ['NE', 'SE', 'C'] }
const BEDROOM: Placement = { label: 'bedroom', ideal: ['SW', 'S', 'W', 'NW'], acceptable: ['N', 'E', 'SE'], avoid: ['NE', 'C'] }
const QUIET_ROOM: Placement = { label: 'quiet / prayer room', ideal: ['NE'], acceptable: ['N', 'E'], avoid: ['S', 'SW', 'SE'] }
const BATHROOM: Placement = { label: 'bathroom', ideal: ['NW', 'W'], acceptable: ['S', 'SE', 'N', 'E'], avoid: ['NE', 'SW', 'C'] }
const LIVING: Placement = { label: 'living room', ideal: ['N', 'NE', 'E', 'NW'], acceptable: ['W', 'C'], avoid: [] }
const STORE: Placement = { label: 'store room', ideal: ['SW', 'S', 'W'], acceptable: ['NW', 'SE', 'N', 'E', 'C'], avoid: ['NE'] }
const STAIRCASE: Placement = { label: 'staircase', ideal: ['S', 'SW', 'W'], acceptable: ['SE', 'NW', 'N', 'E'], avoid: ['NE', 'C'] }

function placementFor(room: PlanRoom, ctx: CheckContext): Placement | null {
  if (isKitchen(room)) return KITCHEN
  if (room.id === ctx.masterBedroomId) return MASTER_BEDROOM
  if (isBedroom(room)) return BEDROOM
  if (isQuietRoom(room)) return QUIET_ROOM
  if (isBathroom(room)) return BATHROOM
  if (room.type === 'living') return LIVING
  if (nameMatches(room, 'store')) return STORE
  return null
}

type Verdict = 'ideal' | 'acceptable' | 'not recommended' | 'best avoided'

function judge(zone: Zone, placement: Placement): { status: CheckStatus; verdict: Verdict } {
  if (placement.ideal.includes(zone)) return { status: 'pass', verdict: 'ideal' }
  if (placement.acceptable?.includes(zone)) return { status: 'pass', verdict: 'acceptable' }
  if (placement.avoid.includes(zone)) return { status: 'fail', verdict: 'best avoided' }
  return { status: 'warn', verdict: 'not recommended' }
}

/** e.g. "For a kitchen this zone is best avoided. Ideal: south-east." */
function explain(placement: Placement, verdict: Verdict) {
  const ideal = placement.ideal.map((z) => ZONE_LABELS[z]).join(', ')
  return `For a ${placement.label} this zone is ${verdict}. Ideal: ${ideal}.`
}

/** The road-facing half of each side that Vastu favours for the main entrance. */
function entranceIsFavourable(ctx: CheckContext, along: number) {
  const { facing, width, height } = ctx.plot
  if (facing === 'north' || facing === 'south') return along >= width / 2 // towards the east
  return along <= height / 2 // east- and west-facing: towards the north
}

export function vastuChecks(ctx: CheckContext): CheckResult[] {
  const results: CheckResult[] = []

  for (const { room, model } of ctx.allRooms) {
    const placement = placementFor(room, ctx)
    if (!placement) continue
    const zone = roomZone(room, ctx.plot)
    const { status, verdict } = judge(zone, placement)
    results.push({
      id: `vastu-${room.id}`,
      category: 'vastu',
      status,
      title: verdict === 'ideal' ? `${room.name} in the ${ZONE_LABELS[zone]} (ideal)` : `${room.name} in the ${ZONE_LABELS[zone]}`,
      detail: verdict === 'ideal' ? undefined : explain(placement, verdict),
      roomIds: [room.id],
      floorId: model.floor.id,
      weight: placement === KITCHEN || placement === MASTER_BEDROOM ? 2 : 1,
    })
  }

  for (const model of ctx.models) {
    for (const stair of model.floor.staircases) {
      const length = stair.treadCount * stair.treadDepth
      const zone = zoneOf({ x: stair.x + stair.width / 2, y: stair.y + length / 2 }, ctx.plot)
      const { status, verdict } = judge(zone, STAIRCASE)
      results.push({
        id: `vastu-stair-${stair.id}`,
        category: 'vastu',
        status,
        title: `Staircase in the ${ZONE_LABELS[zone]}`,
        detail: verdict === 'ideal' ? undefined : explain(STAIRCASE, verdict),
        floorId: model.floor.id,
      })
    }
  }

  const mainDoor = ctx.lowest?.openings.find((opening) => opening.kind === 'main-door')
  if (mainDoor) {
    const favourable = entranceIsFavourable(ctx, mainDoor.center)
    const towards = ctx.plot.facing === 'north' || ctx.plot.facing === 'south' ? 'east' : 'north'
    results.push({
      id: 'vastu-entrance',
      category: 'vastu',
      status: favourable ? 'pass' : 'warn',
      title: favourable ? `Main entrance towards the ${towards} of the ${ctx.plot.facing} side` : 'Main entrance is on the less favoured half of the road side',
      detail: favourable ? undefined : `For a ${ctx.plot.facing}-facing plot, Vastu favours the entrance towards the ${towards}.`,
      roomIds: mainDoor.roomIds,
      floorId: ctx.lowest?.floor.id,
      weight: 2,
    })
  }

  return results
}
