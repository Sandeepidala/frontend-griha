import { SETBACK_SIDES, providedSetbacks, requiredSetbacks, unionRect, type Side } from '@/lib/drawings/geometry'
import type { CheckContext } from '../context'
import type { CheckResult } from '../types'

/** Typical upper limit on ground coverage in Indian bye-laws; step 5 replaces this with local rules. */
const TYPICAL_MAX_COVERAGE = 0.75

const SIDE_NAMES: Record<'front' | 'rear' | 'left' | 'right', string> = {
  front: 'Front (road side)',
  rear: 'Rear',
  left: 'Left',
  right: 'Right',
}

/** Open space around the building, ground coverage, and floors left empty. */
export function siteChecks(ctx: CheckContext): CheckResult[] {
  const results: CheckResult[] = []
  const footprints = ctx.models.map((model) => model.footprint).filter((f) => f !== null)
  const building = unionRect(footprints)
  if (!building) return results

  const required = requiredSetbacks(ctx.plot)
  const provided = providedSetbacks(ctx.plot, building)
  const sides = SETBACK_SIDES[ctx.plot.facing]
  let short = 0
  for (const key of ['front', 'rear', 'left', 'right'] as const) {
    const side: Side = sides[key]
    const need = required[side]
    const have = Math.max(0, provided[side])
    if (need <= 0 || have >= need - 0.05) continue
    short++
    results.push({
      id: `site-setback-${key}`,
      category: 'site',
      status: 'fail',
      title: `${SIDE_NAMES[key]} setback is ${have.toFixed(1)} ft; ${need} ft is required`,
      detail: 'Rooms and outer walls must stay inside the setback lines shown on the plan.',
      weight: 2,
    })
  }
  if (short === 0) {
    results.push({ id: 'site-setbacks', category: 'site', status: 'pass', title: 'The building stays within all four setbacks', weight: 2 })
  }

  const ground = ctx.lowest?.footprint
  if (ground) {
    // Outer walls can overhang a plan drawn to the boundary; only built area inside the plot counts.
    const inside = {
      width: Math.max(0, Math.min(ground.x + ground.width, ctx.plot.width) - Math.max(ground.x, 0)),
      height: Math.max(0, Math.min(ground.y + ground.height, ctx.plot.height) - Math.max(ground.y, 0)),
    }
    const coverage = (inside.width * inside.height) / (ctx.plot.width * ctx.plot.height)
    results.push({
      id: 'site-coverage',
      category: 'site',
      status: coverage <= TYPICAL_MAX_COVERAGE ? 'pass' : 'warn',
      title: `Ground coverage ${Math.round(coverage * 100)}% of the plot`,
      detail:
        coverage <= TYPICAL_MAX_COVERAGE
          ? undefined
          : `Most bye-laws allow about ${Math.round(TYPICAL_MAX_COVERAGE * 100)}% at most; check your local limit.`,
    })
  }

  for (const model of ctx.models) {
    if (model.rooms.length > 0) continue
    results.push({
      id: `site-empty-${model.floor.id}`,
      category: 'site',
      status: 'warn',
      title: `${model.floor.name} has no rooms`,
      floorId: model.floor.id,
    })
  }

  return results
}
