import { effectiveSbc } from '@/lib/site'
import { CONSTRAINT_ALERT_M, CONSTRAINT_LABELS } from '@/types/site'
import type { CheckContext } from '../context'
import type { CheckResult } from '../types'

/**
 * Checks from the site details (location step): soil, plot level against the road, nearby features
 * that carry clearances, and the earthquake zone. Nothing is checked until the site has been read.
 */
export function groundChecks(ctx: CheckContext): CheckResult[] {
  const site = ctx.site
  const report = site?.report
  if (!site || !report) return []
  const results: CheckResult[] = []
  const details = site.details

  const soil = report.soil
  const sbc = effectiveSbc(site)
  if (soil?.expansive && !(details?.soilReport && details.sbcKnM2)) {
    results.push({
      id: 'ground-expansive-soil',
      category: 'site',
      status: 'warn',
      title: 'Swelling (black cotton) soil is likely here',
      detail: `${soil.advice} Get a soil investigation before finalising the foundation.`,
      weight: 2,
    })
  } else if (sbc.assumed) {
    results.push({
      id: 'ground-soil-test',
      category: 'site',
      status: 'warn',
      title: `Foundations assume ${sbc.value} kN/m² bearing; no soil test yet`,
      detail: 'A soil test (IS 1892) gives the real bearing capacity and water table; footings may then be smaller or need to change.',
    })
  } else {
    results.push({ id: 'ground-soil-test', category: 'site', status: 'pass', title: `Soil tested: safe bearing capacity ${sbc.value} kN/m²` })
  }

  if (details?.roadLevel === 'below') {
    results.push({
      id: 'ground-below-road',
      category: 'site',
      status: 'warn',
      title: 'The plot is below the road',
      detail: 'Raise the plinth to at least 450 mm above the road, and grade the yard so rainwater runs away from the house to a drain or recharge pit.',
      weight: 2,
    })
  }

  for (const c of report.constraints) {
    if (c.distance_m > CONSTRAINT_ALERT_M[c.kind]) continue
    results.push({
      id: `ground-near-${c.kind}`,
      category: 'site',
      status: c.kind === 'power_line' && c.distance_m <= 15 ? 'fail' : 'warn',
      title: `${CONSTRAINT_LABELS[c.kind]} ${c.distance_m} m away${c.name ? ` (${c.name})` : ''}`,
      detail: c.note,
      weight: 2,
    })
  }

  const zone = report.seismic_zone?.value
  if (zone === 'IV' || zone === 'V') {
    results.push({
      id: 'ground-seismic',
      category: 'site',
      status: 'warn',
      title: `Earthquake zone ${zone}: ductile detailing is required`,
      detail: 'Design to IS 1893 with IS 13920 ductile detailing; keep the plan regular and avoid soft storeys (open parking under rooms needs care).',
    })
  }
  return results
}
