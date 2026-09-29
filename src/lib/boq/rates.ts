/**
 * Unit rates for the cost estimate, in ₹, including material, labour and wastage.
 *
 * INDICATIVE PLACEHOLDERS: typical 2026 figures for a Tier-2 Indian city at a standard
 * specification, meant only to make estimates realistic in shape. They must be replaced with
 * rates confirmed by the team (per city and specification) before customers rely on the numbers.
 * Everything that prices a quantity reads from this file.
 */
export const RATES_AS_OF = 'Indicative rates, 2026 (placeholder — confirm with the team)'

export type RateUnit = 'cum' | 'sqft' | 'rft' | 'nos' | 'LS'

export const UNIT_LABELS: Record<RateUnit, string> = {
  cum: 'm³',
  sqft: 'sq ft',
  rft: 'rft',
  nos: 'nos',
  LS: 'LS',
}

export interface Rate {
  label: string
  unit: RateUnit
  rate: number
}

export const RATES = {
  // Substructure
  excavation: { label: 'Earthwork excavation for footings', unit: 'cum', rate: 450 },
  pcc: { label: 'PCC 1:4:8 bed under footings (100 mm)', unit: 'cum', rate: 6200 },
  rccFooting: { label: 'RCC M20 isolated footings, incl. steel', unit: 'cum', rate: 10500 },
  plinthFilling: { label: 'Plinth filling, soling and PCC base for flooring', unit: 'sqft', rate: 55 },
  // Frame
  rccColumn: { label: 'RCC M20 columns, incl. steel and formwork', unit: 'cum', rate: 13500 },
  rccBeam: { label: 'RCC M20 beams (plinth and floor), incl. steel and formwork', unit: 'cum', rate: 13000 },
  rccSlab: { label: 'RCC M20 slabs, incl. steel and formwork', unit: 'cum', rate: 12500 },
  staircase: { label: 'RCC dog-leg staircase with granite treads, per riser', unit: 'nos', rate: 5500 },
  // Walls
  brick230: { label: 'Brick masonry 230 mm (outer walls)', unit: 'sqft', rate: 145 },
  brick115: { label: 'Brick masonry 115 mm (partitions)', unit: 'sqft', rate: 78 },
  plasterExternal: { label: 'External cement plaster 20 mm', unit: 'sqft', rate: 42 },
  paintExternal: { label: 'Exterior weatherproof emulsion', unit: 'sqft', rate: 32 },
  roofWaterproofing: { label: 'Terrace waterproofing with brickbat coba', unit: 'sqft', rate: 75 },
  // Room finishes
  plasterInternal: { label: 'Internal plaster 12 mm', unit: 'sqft', rate: 30 },
  paintInternal: { label: 'Wall putty and interior emulsion', unit: 'sqft', rate: 24 },
  ceilingFinish: { label: 'Ceiling plaster, putty and paint', unit: 'sqft', rate: 28 },
  dadoTiles: { label: 'Wall tiles (dado)', unit: 'sqft', rate: 110 },
  wetWaterproofing: { label: 'Bathroom floor waterproofing', unit: 'sqft', rate: 95 },
  // Flooring by finish (supply and lay, incl. skirting)
  floorTile: { label: 'Vitrified tile flooring', unit: 'sqft', rate: 120 },
  floorMarble: { label: 'Marble flooring', unit: 'sqft', rate: 260 },
  floorWood: { label: 'Engineered wood flooring', unit: 'sqft', rate: 330 },
  floorCarpet: { label: 'Carpet flooring', unit: 'sqft', rate: 150 },
  floorConcrete: { label: 'Polished concrete (IPS) flooring', unit: 'sqft', rate: 60 },
  // Doors and windows
  mainDoor: { label: 'Main door, teak frame and shutter, with hardware', unit: 'nos', rate: 48000 },
  internalDoor: { label: 'Internal flush door with frame and hardware', unit: 'nos', rate: 15000 },
  bathroomDoor: { label: 'Bathroom WPC door with frame', unit: 'nos', rate: 9500 },
  window: { label: 'UPVC sliding windows with glass and grill', unit: 'sqft', rate: 700 },
  ventilator: { label: 'Ventilator with louvres', unit: 'nos', rate: 3500 },
  // Electrical points (wiring, conduit, switch/socket)
  elecLight: { label: 'Light point', unit: 'nos', rate: 1200 },
  elecFan: { label: 'Fan point', unit: 'nos', rate: 1400 },
  elecExhaust: { label: 'Exhaust fan point', unit: 'nos', rate: 1300 },
  elecSwitchboard: { label: 'Modular switchboard', unit: 'nos', rate: 2000 },
  elecSocket: { label: '6A socket point', unit: 'nos', rate: 1300 },
  elecPowerSocket: { label: '16A power socket point', unit: 'nos', rate: 1800 },
  elecAc: { label: 'AC point (20A)', unit: 'nos', rate: 2800 },
  elecGeyser: { label: 'Geyser point (16A)', unit: 'nos', rate: 2200 },
  elecTv: { label: 'TV and data point', unit: 'nos', rate: 1800 },
  elecBell: { label: 'Call bell point', unit: 'nos', rate: 900 },
  distributionBoard: { label: 'Distribution board with MCBs', unit: 'nos', rate: 18000 },
  earthing: { label: 'Earthing and main service cable', unit: 'LS', rate: 35000 },
  // Plumbing
  waterPipes: { label: 'CPVC water supply pipes with fittings', unit: 'rft', rate: 180 },
  drainPipes: { label: 'UPVC SWR soil, waste and rainwater pipes', unit: 'rft', rate: 260 },
  chambers: { label: 'Inspection chambers and gully traps', unit: 'nos', rate: 6500 },
  waterTank: { label: 'Overhead tank, pump and connections', unit: 'LS', rate: 45000 },
  wc: { label: 'Wall-hung WC with concealed cistern', unit: 'nos', rate: 13000 },
  basin: { label: 'Wash basin with mixer', unit: 'nos', rate: 7000 },
  shower: { label: 'Shower set with diverter', unit: 'nos', rate: 9000 },
  sink: { label: 'Kitchen sink with tap', unit: 'nos', rate: 8000 },
  // Interiors (turnkey only)
  wardrobe: { label: 'Built-in wardrobe (face area)', unit: 'sqft', rate: 1500 },
  modularKitchen: { label: 'Modular kitchen, base and wall units', unit: 'rft', rate: 15000 },
  falseCeiling: { label: 'Gypsum false ceiling', unit: 'sqft', rate: 130 },
  lightFixture: { label: 'LED light fixtures', unit: 'nos', rate: 1800 },
  ceilingFan: { label: 'Ceiling fans', unit: 'nos', rate: 3800 },
  exhaustFan: { label: 'Exhaust fans', unit: 'nos', rate: 2200 },
  tvUnit: { label: 'TV unit', unit: 'nos', rate: 38000 },
  studyUnit: { label: 'Study desk and shelves', unit: 'nos', rate: 28000 },
  poojaUnit: { label: 'Prayer / quiet-room unit', unit: 'nos', rate: 35000 },
  shoeRack: { label: 'Shoe rack', unit: 'nos', rate: 14000 },
  shelf: { label: 'Wall shelves', unit: 'nos', rate: 9000 },
  bathAccessories: { label: 'Mirror, towel rails and bath accessories', unit: 'nos', rate: 16000 },
} as const satisfies Record<string, Rate>

export type RateKey = keyof typeof RATES

/** Added on top of the item total. */
export const OVERHEADS = [
  { id: 'overhead', label: 'Contractor overhead and profit', pct: 0.1 },
  { id: 'contingency', label: 'Contingency', pct: 0.05 },
] as const

/**
 * Multipliers on every rate for cities that cost more (or less) than the Tier-2 baseline.
 * Placeholders alongside the rates above.
 */
export const LOCATION_FACTORS: { match: RegExp; label: string; factor: number }[] = [
  { match: /mumbai|navi mumbai|thane/i, label: 'Mumbai region', factor: 1.25 },
  { match: /delhi|gurugram|gurgaon|noida|ghaziabad|faridabad/i, label: 'Delhi NCR', factor: 1.15 },
  { match: /bengaluru|bangalore/i, label: 'Bengaluru', factor: 1.12 },
  { match: /pune/i, label: 'Pune', factor: 1.1 },
  { match: /chennai/i, label: 'Chennai', factor: 1.1 },
  { match: /hyderabad|secunderabad/i, label: 'Hyderabad', factor: 1.08 },
  { match: /kolkata/i, label: 'Kolkata', factor: 1.05 },
  { match: /ahmedabad/i, label: 'Ahmedabad', factor: 1.05 },
]

export function locationFactor(city: string | null | undefined): { factor: number; label: string } {
  const hit = city ? LOCATION_FACTORS.find((l) => l.match.test(city)) : undefined
  return hit ? { factor: hit.factor, label: hit.label } : { factor: 1, label: 'Standard (Tier-2 baseline)' }
}
