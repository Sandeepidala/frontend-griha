import { SETBACK_SIDES, providedSetbacks, requiredSetbacks, unionRect, type Side } from '@/lib/drawings/geometry'
import type { CheckContext } from '../context'
import type { CheckResult } from '../types'


const SIDE_NAMES: Record<'front' | 'rear' | 'left' | 'right', string> = {
  front: 'Front (road side)',
  rear: 'Rear',
  left: 'Left',
  right: 'Right',
}

/** The building against the setback lines set on the plot, and floors left empty (coverage is a bye-law check). */
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
