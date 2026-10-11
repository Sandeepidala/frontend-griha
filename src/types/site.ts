/**
 * What open data says about a marked plot (backend app/services/site), kept exactly as the API sends
 * it: it's read-only, shown and printed, never edited field by field. What the customer confirms or
 * enters goes in SiteDetails instead.
 */

export type FactConfidence = 'measured' | 'official' | 'estimated' | 'indicative' | 'entered'

export interface Fact {
  value: number | string | boolean | null
  unit: string | null
  source: string
  confidence: FactConfidence
  note: string | null
}

export interface RoadInfo {
  name: string | null
  /** OpenStreetMap road class, e.g. "residential", "secondary". */
  kind: string
  /** Right-of-way, boundary to boundary. */
  width: Fact
  /** From the middle of the plot's road side to the road's centreline. */
  centreline_distance_m: number
  lanes: number | null
  surface: string | null
  osm_id: number | null
}

export interface SoilInfo {
  kind: string
  label: Fact
  expansive: boolean
  sbc_range_kn_m2: [number, number] | null
  advice: string
  texture: { clay: number; sand: number; silt: number } | null
}

export interface NearbyConstraint {
  kind: 'water' | 'waterway' | 'power_line' | 'railway'
  name: string | null
  distance_m: number
  detail: string | null
  note: string
}

export interface SiteReport {
  generated_at: string
  road: RoadInfo | null
  second_road: RoadInfo | null
  corner_plot: Fact | null
  /** A public road runs along this side rather than the one marked as the road side. */
  suggested_road_edge: number | null
  elevation: Fact | null
  slope: Fact | null
  annual_rainfall: Fact | null
  seismic_zone: Fact | null
  wind_speed: Fact | null
  soil: SoilInfo | null
  constraints: NearbyConstraint[]
  /** Sources that didn't answer; the user can try again. */
  unavailable: string[]
}

/** What the customer confirmed or entered about the site; overrides the report's estimates. */
export interface SiteDetails {
  /** Right-of-way in metres. */
  roadWidthM: number | null
  /** Measured on the map (or entered from the sale deed/layout plan) rather than estimated. */
  roadWidthMeasured: boolean
  /** The plot's ground compared with the road in front. */
  roadLevel: 'above' | 'level' | 'below' | null
  soilReport: boolean
  /** Safe bearing capacity from the soil test report, kN/m². */
  sbcKnM2: number | null
  soilType: string | null
  groundwaterDepthM: number | null
  waterSupply: boolean | null
  sewer: boolean | null
  electricity: boolean | null
}

export const EMPTY_SITE_DETAILS: SiteDetails = {
  roadWidthM: null,
  roadWidthMeasured: false,
  roadLevel: null,
  soilReport: false,
  sbcKnM2: null,
  soilType: null,
  groundwaterDepthM: null,
  waterSupply: null,
  sewer: null,
  electricity: null,
}

export const CONSTRAINT_LABELS: Record<NearbyConstraint['kind'], string> = {
  water: 'Lake or water body',
  waterway: 'Stream, drain or canal',
  power_line: 'Overhead power line',
  railway: 'Railway line',
}

/** Distances under which a nearby feature needs checking before design (metres). */
export const CONSTRAINT_ALERT_M: Record<NearbyConstraint['kind'], number> = {
  water: 75,
  waterway: 50,
  power_line: 30,
  railway: 60,
}
