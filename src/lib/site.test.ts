import { describe, expect, it, vi } from 'vitest'
import { fullSetMarkup } from '@/components/drawings/exportSheets'
import { DEFAULT_BRIEF } from '@/lib/brief'
import { estimateBoq } from '@/lib/boq'
import { runDesignCheck } from '@/lib/designCheck'
import { buildDrawingSet, sheetRegister } from '@/lib/drawings/sheets'
import type { Floor, Plot, Room, RoomType } from '@/types/design'
import type { SiteLocation } from '@/types/project'
import { EMPTY_SITE_DETAILS, type SiteReport } from '@/types/site'
import { ASSUMED_SBC_KN_M2, effectiveSbc, foundationAllowance, rainwaterLitresPerYear } from './site'

// The projects API module reads the saved session when it loads, so storage must exist first.
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
const { mapSite, siteToDto } = await import('@/lib/projectsApi')

const plot: Plot = { width: 30, height: 40, facing: 'north', units: 'ft', setbacks: { front: 5, rear: 3.5, left: 3.5, right: 3.5 } }
let n = 0
const room = (name: string, type: RoomType, x: number, y: number, width: number, height: number): Room => ({
  id: `r${++n}`, name, type, x, y, width, height, rotation: 0, wallHeight: 9, elevation: 0, color: null,
  floorFinish: 'tile', locked: false, visible: true, label: null, notes: '',
})
const floors: Floor[] = [
  {
    id: 'f0', name: 'Ground Floor', level: 0, elevation: 0,
    rooms: [room('Living Room', 'living', 4, 6, 12, 14), room('Kitchen', 'kitchen', 16, 6, 10, 14), room('Bedroom', 'bedroom', 4, 20, 22, 12)],
    wallOverrides: {}, openings: [], furniture: [], staircases: [], guides: { vertical: [], horizontal: [] },
  },
]

const fact = (value: number | string, extra: Partial<SiteReport['seismic_zone'] & object> = {}) => ({
  value, unit: null, source: 'test', confidence: 'estimated' as const, note: null, ...extra,
})

function report(overrides: Partial<SiteReport> = {}): SiteReport {
  return {
    generated_at: '2026-10-11T00:00:00Z',
    road: { name: '1st Main', kind: 'residential', width: fact(9, { unit: 'm' }), centreline_distance_m: 6, lanes: 2, surface: 'asphalt', osm_id: 1 },
    second_road: null,
    corner_plot: null,
    suggested_road_edge: null,
    elevation: fact(920, { unit: 'm' }),
    slope: fact(2.5, { unit: '%' }),
    annual_rainfall: fact(970, { unit: 'mm/year' }),
    seismic_zone: fact('II', { confidence: 'official' }),
    wind_speed: fact(33, { unit: 'm/s', confidence: 'official' }),
    soil: { kind: 'red_laterite', label: fact('Red / lateritic soil', { confidence: 'indicative' }), expansive: false, sbc_range_kn_m2: [150, 300], advice: 'Generally good.', texture: null },
    constraints: [],
    unavailable: [],
    ...overrides,
  }
}

function site(r: SiteReport | null, details = EMPTY_SITE_DETAILS): SiteLocation {
  return {
    provider: 'open', placeId: 'osm:R1', formattedAddress: 'Jayanagar, Bengaluru', lat: 12.93, lng: 77.58, country: 'India',
    countryCode: 'IN', state: 'Karnataka', city: 'Bengaluru', postcode: '560011', locality: 'Jayanagar',
    boundary: null, roadEdge: null, rotationDeg: null, origin: null, report: r, details,
  }
}

const blackCotton = report({
  soil: { kind: 'black_cotton', label: fact('Black cotton (expansive clay)', { confidence: 'indicative' }), expansive: true, sbc_range_kn_m2: [50, 100], advice: 'Swells and shrinks.', texture: null },
})

describe('site helpers', () => {
  it('assumes a conservative bearing capacity until a soil test is entered', () => {
    expect(effectiveSbc(site(report()))).toEqual({ value: ASSUMED_SBC_KN_M2, assumed: true })
    expect(effectiveSbc(site(report(), { ...EMPTY_SITE_DETAILS, soilReport: true, sbcKnM2: 180 }))).toEqual({ value: 180, assumed: false })
  })

  it('adds a foundation allowance for swelling, soft or weak tested soil only', () => {
    expect(foundationAllowance(site(report()))).toBeNull()
    expect(foundationAllowance(site(blackCotton))?.extra).toBe(0.35)
    expect(foundationAllowance(site(report(), { ...EMPTY_SITE_DETAILS, soilReport: true, sbcKnM2: 80 }))?.extra).toBe(0.25)
  })

  it('estimates the rain a roof collects', () => {
    // 1,000 sq ft × 970 mm × 0.8 runoff ≈ 72,000 litres.
    expect(rainwaterLitresPerYear(1000, 970)).toBe(72093)
  })

  it('round-trips the site through the API shape', () => {
    const s = site(report(), { ...EMPTY_SITE_DETAILS, roadWidthM: 9.2, roadWidthMeasured: true, roadLevel: 'below' })
    expect(mapSite(siteToDto(s))).toEqual(s)
  })
})

describe('the site in design, cost and drawings', () => {
  it('warns about swelling soil, a plot below the road, nearby power lines and high earthquake zones', () => {
    const risky = site(
      report({
        ...blackCotton,
        seismic_zone: fact('IV', { confidence: 'official' }),
        constraints: [{ kind: 'power_line', name: null, distance_m: 12, detail: '11 kV', note: 'Clearances apply.' }],
      }),
      { ...EMPTY_SITE_DETAILS, roadLevel: 'below' },
    )
    const results = runDesignCheck({ plot, floors, brief: DEFAULT_BRIEF, site: risky }).results.filter((r) => r.id.startsWith('ground-'))
    // The report lists failures first; compare as a set.
    expect(Object.fromEntries(results.map((r) => [r.id, r.status]))).toEqual(Object.fromEntries([
      ['ground-expansive-soil', 'warn'],
      ['ground-below-road', 'warn'],
      ['ground-near-power_line', 'fail'],
      ['ground-seismic', 'warn'],
    ]))
    // Without a site report there's nothing to check.
    expect(runDesignCheck({ plot, floors, brief: DEFAULT_BRIEF }).results.some((r) => r.id.startsWith('ground-'))).toBe(false)
  })

  it('prices the soil allowance on the foundations', () => {
    const plain = estimateBoq({ plot, floors, brief: DEFAULT_BRIEF, budget: null, site: site(report()) })
    const swelling = estimateBoq({ plot, floors, brief: DEFAULT_BRIEF, budget: null, site: site(blackCotton) })
    const foundations = (e: typeof plain) => e.sections.find((s) => s.id === 'foundation')!
    const allowance = foundations(swelling).lines.find((l) => l.rateKey === 'soilAllowance')!
    expect(foundations(plain).lines.some((l) => l.rateKey === 'soilAllowance')).toBe(false)
    expect(allowance.amount).toBe(Math.round(foundations(plain).subtotal * 0.35))
    expect(allowance.description).toContain('swelling')
  })

  it('adds a Site report sheet when the project has one', () => {
    const s = site(report(), { ...EMPTY_SITE_DETAILS, roadWidthM: 9.2, roadWidthMeasured: true })
    const set = buildDrawingSet(plot, floors, 'Sharma Residence', 'Griha', { brief: DEFAULT_BRIEF, budget: null, site: s })
    expect(sheetRegister(floors).some((sh) => sh.kind === 'site-report')).toBe(false)
    const pages = fullSetMarkup(set, sheetRegister(floors, { siteReport: true }))
    const sheet = pages.find((p) => p.code === 'G-003')!.markup
    expect(sheet).toContain('1st Main')
    expect(sheet).toContain('9.2 m')
    expect(sheet).toContain('Zone II')
    expect(sheet).toContain('Assumed')
    expect(sheet).toContain('kL a year')
  })
})
