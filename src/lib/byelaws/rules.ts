/**
 * Building bye-law rule sets (project document §9.3, §10).
 *
 * PLACEHOLDERS: the generic set below follows the common shape of Indian municipal residential
 * rules (setbacks by plot depth and frontage, coverage by plot area, FAR and height by road width)
 * with made-up round numbers. It is NOT any real authority's rules. Real sets, per state or
 * municipality, go in BYELAW_SETS with their source and status 'verified' once the team has them.
 * Lengths are in metres, as bye-laws publish them; lib/byelaws converts to feet.
 */

/** A value that depends on a measurement: the first band whose `upTo` covers it applies. */
export interface Band {
  /** Inclusive upper bound; omit on the last band. */
  upTo?: number
  value: number
}

export interface ByeLawSet {
  id: string
  name: string
  /** Where it's from, e.g. "BBMP Zoning Regulations 2015, Table 4". */
  source: string
  status: 'placeholder' | 'verified'
  /** Which projects it applies to, by the brief's state and city; the generic set has none. */
  appliesTo?: { states?: string[]; cities?: RegExp }
  /** By plot depth (road to rear), metres. */
  frontSetback: Band[]
  rearSetback: Band[]
  /** By plot frontage (along the road), metres; applies to each side. */
  sideSetback: Band[]
  /** Maximum ground coverage, fraction of plot area, by plot area in m². */
  maxCoverage: Band[]
  /** Floor area ratio (FAR/FSI): total built-up area ÷ plot area, by road width in metres. */
  far: Band[]
  /** Maximum building height in metres, by road width in metres. */
  maxHeight: Band[]
  /** Car spaces required, by plot area in m². */
  parking: Band[]
  /** Road width to assume when the brief doesn't give one, metres. */
  defaultRoadWidth: number
}

export const GENERIC_PLACEHOLDER: ByeLawSet = {
  id: 'generic-placeholder',
  name: 'Generic Indian residential rules (placeholder)',
  source: 'Illustrative values only — not from any authority. Replace with your municipality’s bye-laws.',
  status: 'placeholder',
  frontSetback: [
    { upTo: 12, value: 1 },
    { upTo: 15, value: 1.5 },
    { upTo: 18, value: 2 },
    { upTo: 21, value: 3 },
    { value: 3.5 },
  ],
  rearSetback: [
    { upTo: 12, value: 0.75 },
    { upTo: 15, value: 1 },
    { upTo: 18, value: 1.5 },
    { upTo: 21, value: 2 },
    { value: 2.5 },
  ],
  sideSetback: [
    { upTo: 9, value: 0.75 },
    { upTo: 12, value: 1 },
    { upTo: 15, value: 1.2 },
    { value: 1.5 },
  ],
  maxCoverage: [
    { upTo: 150, value: 0.75 },
    { upTo: 300, value: 0.65 },
    { upTo: 500, value: 0.6 },
    { value: 0.55 },
  ],
  far: [
    { upTo: 9, value: 1.75 },
    { upTo: 12, value: 2 },
    { upTo: 18, value: 2.25 },
    { value: 2.5 },
  ],
  maxHeight: [{ upTo: 9, value: 11.5 }, { value: 15 }],
  parking: [
    { upTo: 100, value: 0 },
    { upTo: 250, value: 1 },
    { value: 2 },
  ],
  defaultRoadWidth: 9,
}

/**
 * Real rule sets go here, e.g.:
 *   { ...GENERIC_PLACEHOLDER, id: 'ka-bbmp', name: 'Bengaluru (BBMP)', source: '…', status: 'verified',
 *     appliesTo: { states: ['Karnataka'], cities: /bengaluru|bangalore/i }, frontSetback: [...], ... }
 * The first set matching the brief's state and city is used; otherwise the generic placeholder.
 */
export const BYELAW_SETS: ByeLawSet[] = []

export function bandValue(bands: Band[], measure: number) {
  return (bands.find((b) => b.upTo === undefined || measure <= b.upTo) ?? bands[bands.length - 1]).value
}
