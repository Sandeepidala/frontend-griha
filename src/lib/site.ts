import type { SiteLocation } from '@/types/project'

/**
 * What the site details mean for design and cost. Values the customer entered (e.g. from a soil
 * test report) win over the report's estimates.
 */

/** Assumed until a soil test result is entered: a conservative value for shallow footings, kN/m². */
export const ASSUMED_SBC_KN_M2 = 100

export function effectiveSbc(site: SiteLocation | null | undefined): { value: number; assumed: boolean } {
  const entered = site?.details?.soilReport ? site.details.sbcKnM2 : null
  return entered ? { value: entered, assumed: false } : { value: ASSUMED_SBC_KN_M2, assumed: true }
}

export interface FoundationAllowance {
  /** Extra on the foundation and plinth section, as a fraction (0.3 = +30%). */
  extra: number
  reason: string
}

/**
 * Extra foundation cost the soil is likely to need: swelling clay needs deeper footings or
 * under-reamed piles; soft ground needs bigger footings or a raft; a weak tested soil, wider footings.
 */
export function foundationAllowance(site: SiteLocation | null | undefined): FoundationAllowance | null {
  if (!site) return null
  const sbc = effectiveSbc(site)
  const soil = site.report?.soil
  if (soil?.expansive) return { extra: 0.35, reason: 'swelling (black cotton) soil: deeper footings or under-reamed piles' }
  if (soil?.kind === 'soft_marine_clay') return { extra: 0.3, reason: 'soft clay: larger footings or a raft' }
  if (!sbc.assumed && sbc.value < 100) return { extra: 0.25, reason: `low bearing capacity (${sbc.value} kN/m²): wider footings` }
  return null
}

/** Litres of rain a roof collects in a year: area × rainfall × runoff (0.8 for an RCC roof). */
export function rainwaterLitresPerYear(roofSqft: number, rainfallMm: number) {
  return Math.round(roofSqft * 0.092903 * rainfallMm * 0.8)
}
