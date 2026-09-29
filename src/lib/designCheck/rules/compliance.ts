import { requirementsFor } from '@/lib/byelaws'
import { SETBACK_SIDES, providedSetbacks, unionRect, wallsArea } from '@/lib/drawings/geometry'
import { isParking, sqft, type CheckContext } from '../context'
import type { CheckResult } from '../types'

/** One car space, 2.5 m × 5 m. */
const CAR_SPACE_SQFT = 135

const SIDE_NAMES = { front: 'Front (road side)', rear: 'Rear', left: 'Left', right: 'Right' } as const

const pct = (fraction: number) => `${Math.round(fraction * 100)}%`

/**
 * Checks against the building bye-laws that apply to the project (lib/byelaws): setbacks from the
 * actual building, ground coverage, floor area ratio, height and parking (document §9.3, §10).
 */
export function complianceChecks(ctx: CheckContext): CheckResult[] {
  const results: CheckResult[] = []
  const req = requirementsFor(ctx.plot, ctx.brief)
  const plotArea = ctx.plot.width * ctx.plot.height
  const footprints = ctx.models.map((m) => m.footprint).filter((f) => f !== null)
  const building = unionRect(footprints)
  if (!building) return results

  // Setbacks: measured from the building's outer walls, not from the lines set on the plot.
  const provided = providedSetbacks(ctx.plot, building)
  const sides = SETBACK_SIDES[ctx.plot.facing]
  let short = 0
  for (const key of ['front', 'rear', 'left', 'right'] as const) {
    const need = req.setbacks[key]
    const have = Math.max(0, provided[sides[key]])
    if (have >= need - 0.05) continue
    short++
    const lineTooLow = ctx.plot.setbacks[key] < need
    results.push({
      id: `law-setback-${key}`,
      category: 'compliance',
      status: 'fail',
      title: `${SIDE_NAMES[key]} setback is ${have.toFixed(1)} ft; the bye-laws require ${need} ft`,
      detail: lineTooLow
        ? `The plot's ${key} setback line is set to ${ctx.plot.setbacks[key]} ft. Use the required setbacks, then keep rooms inside the new line.`
        : 'Move the rooms on this side back inside the setback line.',
      weight: 2,
    })
  }
  if (short === 0) {
    results.push({
      id: 'law-setbacks',
      category: 'compliance',
      status: 'pass',
      title: `Setbacks meet the bye-laws (front ${req.setbacks.front}, rear ${req.setbacks.rear}, sides ${req.setbacks.left} ft)`,
      weight: 2,
    })
  }

  // Ground coverage: built area on the ground inside the plot.
  const ground = ctx.lowest?.footprint
  if (ground) {
    const w = Math.max(0, Math.min(ground.x + ground.width, ctx.plot.width) - Math.max(ground.x, 0))
    const h = Math.max(0, Math.min(ground.y + ground.height, ctx.plot.height) - Math.max(ground.y, 0))
    const coverage = (w * h) / plotArea
    const ok = coverage <= req.maxCoverage + 0.005
    results.push({
      id: 'law-coverage',
      category: 'compliance',
      status: ok ? 'pass' : 'fail',
      title: `Ground coverage ${pct(coverage)} of the plot (limit ${pct(req.maxCoverage)})`,
      detail: ok ? undefined : 'Reduce the ground-floor footprint, e.g. with a smaller parking or living area, or move rooms upstairs.',
      weight: 2,
    })
  }

  // Floor area ratio: every storey's rooms and walls, against the plot area.
  const builtUp = ctx.models.reduce((s, m) => s + m.rooms.reduce((a, r) => a + sqft(r), 0) + wallsArea(m.walls), 0)
  const far = builtUp / plotArea
  results.push({
    id: 'law-far',
    category: 'compliance',
    status: far <= req.far + 0.005 ? 'pass' : 'fail',
    title: `Floor area ratio ${far.toFixed(2)} (limit ${req.far.toFixed(2)} for a ${req.roadWidthFt} ft road)`,
    detail: far <= req.far + 0.005 ? undefined : `Built-up area is ${Math.round(builtUp)} sq ft; the limit allows ${Math.round(req.far * plotArea)} sq ft.`,
    weight: 2,
  })

  // Height: floor-to-floor heights of every storey with rooms, up to the roof slab.
  const storeys = ctx.models.filter((m) => m.rooms.length > 0)
  const height = storeys.reduce((s, m) => s + m.height, 0)
  results.push({
    id: 'law-height',
    category: 'compliance',
    status: height <= req.maxHeightFt + 0.05 ? 'pass' : 'fail',
    title: `Building height ${Math.round(height)} ft over ${storeys.length} ${storeys.length === 1 ? 'storey' : 'storeys'} (limit ${req.maxHeightFt} ft)`,
    detail: height <= req.maxHeightFt + 0.05 ? undefined : 'Remove a floor, or check whether a wider road allows more height.',
  })

  // Parking the rules require for this plot size.
  if (req.parkingCars > 0) {
    const spaces = Math.floor((ctx.lowest?.rooms ?? []).filter(isParking).reduce((s, r) => s + sqft(r), 0) / CAR_SPACE_SQFT)
    results.push({
      id: 'law-parking',
      category: 'compliance',
      status: spaces >= req.parkingCars ? 'pass' : 'fail',
      title: `Parking for ${spaces} car${spaces === 1 ? '' : 's'}; the bye-laws require ${req.parkingCars}`,
      detail: spaces >= req.parkingCars ? undefined : 'Add a ground-floor parking area of about 135 sq ft per car, named "Parking".',
    })
  }

  return results
}
