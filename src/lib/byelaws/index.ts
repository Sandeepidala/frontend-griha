import type { ProjectBrief } from '@/types/brief'
import type { Plot, Setbacks } from '@/types/design'
import { BYELAW_SETS, GENERIC_PLACEHOLDER, bandValue, type ByeLawSet } from './rules'

export { BYELAW_SETS, GENERIC_PLACEHOLDER } from './rules'
export type { ByeLawSet } from './rules'

const M_PER_FT = 0.3048
const SQM_PER_SQFT = M_PER_FT * M_PER_FT
const roundFt = (m: number) => Math.round((m / M_PER_FT) * 10) / 10

export interface ByeLawRequirements {
  set: ByeLawSet
  /** Minimum setbacks, ft, for this plot's size. */
  setbacks: Setbacks
  /** Maximum ground coverage, fraction of plot area. */
  maxCoverage: number
  /** Maximum floor area ratio (total built-up area ÷ plot area). */
  far: number
  /** Maximum building height, ft. */
  maxHeightFt: number
  /** Car spaces the rules require. */
  parkingCars: number
  roadWidthFt: number
  /** What had to be assumed, e.g. a road width the brief didn't give. */
  assumptions: string[]
}

/** The rule set for a project: the first one matching its state and city, else the generic placeholder. */
export function byeLawSetFor(brief: ProjectBrief | null): ByeLawSet {
  return (
    BYELAW_SETS.find((set) => {
      const { states, cities } = set.appliesTo ?? {}
      const stateOk = !states || (!!brief?.state && states.includes(brief.state))
      const cityOk = !cities || (!!brief?.city && cities.test(brief.city))
      return stateOk && cityOk
    }) ?? GENERIC_PLACEHOLDER
  )
}

/** What the bye-laws require of this plot: setbacks by its size, and limits by its area and road. */
export function requirementsFor(plot: Plot, brief: ProjectBrief | null): ByeLawRequirements {
  const set = byeLawSetFor(brief)
  const assumptions: string[] = []
  // Depth runs back from the road; frontage runs along it.
  const alongX = plot.facing === 'north' || plot.facing === 'south'
  const frontageM = (alongX ? plot.width : plot.height) * M_PER_FT
  const depthM = (alongX ? plot.height : plot.width) * M_PER_FT
  const areaSqm = plot.width * plot.height * SQM_PER_SQFT
  let roadM = brief?.roadWidthFt ? brief.roadWidthFt * M_PER_FT : null
  if (roadM === null) {
    roadM = set.defaultRoadWidth
    assumptions.push(`Road width not given in the brief; assumed about ${Math.round(roadM / M_PER_FT)} ft (${roadM} m).`)
  }
  if (brief?.cornerPlot) assumptions.push('Corner plot: the road on the second side usually needs a front-style setback too; check it.')
  const side = roundFt(bandValue(set.sideSetback, frontageM))
  return {
    set,
    setbacks: {
      front: roundFt(bandValue(set.frontSetback, depthM)),
      rear: roundFt(bandValue(set.rearSetback, depthM)),
      left: side,
      right: side,
    },
    maxCoverage: bandValue(set.maxCoverage, areaSqm),
    far: bandValue(set.far, roadM),
    maxHeightFt: roundFt(bandValue(set.maxHeight, roadM)),
    parkingCars: bandValue(set.parking, areaSqm),
    roadWidthFt: Math.round(roadM / M_PER_FT),
    assumptions,
  }
}

/** The plot's setbacks raised to at least what the bye-laws require. */
export function compliantSetbacks(current: Setbacks, required: Setbacks): Setbacks {
  return {
    front: Math.max(current.front, required.front),
    rear: Math.max(current.rear, required.rear),
    left: Math.max(current.left, required.left),
    right: Math.max(current.right, required.right),
  }
}
