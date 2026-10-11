import { ApiError } from '../apiError'
import type { GeoPlaceDto, GeoSuggestion } from '../geo/api'
import type { SiteReport } from '@/types/site'

/**
 * Demo mode's /geo routes: the browser asks OpenStreetMap's public Photon and Nominatim directly,
 * as the backend's open provider does (backend/app/services/geo/open.py). Fine for a demo; the
 * deployed app goes through the backend, which caches and can use Google instead.
 */

const PHOTON = 'https://photon.komoot.io/api/'
const NOMINATIM = 'https://nominatim.openstreetmap.org'
const OSM_TYPES = new Set(['N', 'W', 'R'])

async function getJson(url: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  } catch {
    throw new ApiError(502, 'Location search is unavailable right now.')
  }
  if (!response.ok) throw new ApiError(502, `Location search failed (${response.status}).`)
  return response.json()
}

const join = (...parts: (string | undefined | null)[]) => parts.filter(Boolean).join(', ')

interface NominatimResult {
  osm_type?: string
  osm_id?: number
  lat: string
  lon: string
  display_name?: string
  error?: string
  address?: Record<string, string>
}

function toPlace(data: NominatimResult, lat?: number, lng?: number): GeoPlaceDto {
  const a = data.address ?? {}
  const type = (data.osm_type ?? '').slice(0, 1).toUpperCase()
  return {
    id: OSM_TYPES.has(type) ? `osm:${type}${data.osm_id}` : '',
    provider: 'open',
    formatted_address: data.display_name ?? '',
    lat: lat ?? Number(data.lat),
    lng: lng ?? Number(data.lon),
    country: a.country ?? null,
    country_code: a.country_code ? a.country_code.toUpperCase() : null,
    state: a.state ?? a.region ?? null,
    city: a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? null,
    postcode: a.postcode ?? null,
    locality: a.quarter ?? a.suburb ?? a.neighbourhood ?? a.road ?? null,
  }
}

async function autocomplete(q: string, country: string | null): Promise<GeoSuggestion[]> {
  if (q.trim().length < 2) throw new ApiError(422, 'Type at least two letters.')
  const data = (await getJson(`${PHOTON}?${new URLSearchParams({ q, limit: '6', lang: 'en' })}`)) as {
    features?: { properties: Record<string, string | number> }[]
  }
  const out: GeoSuggestion[] = []
  for (const { properties: p } of data.features ?? []) {
    const type = String(p.osm_type ?? '').toUpperCase()
    if (!OSM_TYPES.has(type) || !p.osm_id) continue
    if (country && String(p.countrycode ?? '').toUpperCase() !== country.toUpperCase()) continue
    const street = p.street ? join(p.housenumber as string, p.street as string) : null
    const title = String(p.name ?? street ?? p.city ?? '')
    out.push({
      id: `osm:${type}${p.osm_id}`,
      title,
      subtitle: join(p.name ? street : null, p.district as string, p.city !== title ? (p.city as string) : null, p.state as string, p.country as string),
    })
  }
  return out
}

/**
 * Demo mode's site report: ground level, slope and rainfall straight from Open-Meteo. Roads, design
 * zones and soil come from the backend, so they're listed as unavailable here.
 */
async function siteReport(body: Record<string, unknown>): Promise<SiteReport> {
  const lat = Number(body.lat)
  const lng = Number(body.lng)
  const dLat = 60 / 111_195
  const dLng = 60 / (111_195 * Math.cos((lat * Math.PI) / 180))
  const probe = [
    [lat, lng],
    [lat + dLat, lng],
    [lat, lng + dLng],
    [lat - dLat, lng],
    [lat, lng - dLng],
  ]
  const year = new Date().getFullYear() - 1
  const [heights, rain] = await Promise.all([
    getJson(
      `https://api.open-meteo.com/v1/elevation?latitude=${probe.map((p) => p[0].toFixed(6)).join(',')}&longitude=${probe.map((p) => p[1].toFixed(6)).join(',')}`,
    ).catch(() => null) as Promise<{ elevation?: number[] } | null>,
    getJson(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&start_date=${year - 9}-01-01&end_date=${year}-12-31&daily=precipitation_sum&timezone=UTC`,
    ).catch(() => null) as Promise<{ daily?: { precipitation_sum?: (number | null)[] } } | null>,
  ])
  const h = heights?.elevation
  const daily = (rain?.daily?.precipitation_sum ?? []).filter((v): v is number => v !== null)
  return {
    generated_at: new Date().toISOString(),
    road: null,
    second_road: null,
    corner_plot: null,
    suggested_road_edge: null,
    elevation: h ? { value: Math.round(h[0]), unit: 'm', source: 'Copernicus DEM via Open-Meteo (~90 m grid)', confidence: 'estimated', note: 'Above sea level.' } : null,
    slope: h
      ? {
          value: Math.round((Math.max(Math.abs(h[1] - h[3]), Math.abs(h[2] - h[4])) / 120) * 1000) / 10,
          unit: '%',
          source: 'Ground levels 60 m either side (Copernicus DEM)',
          confidence: 'estimated',
          note: "General fall of the land around the plot, not the plot itself: confirm the plot's levels on site.",
        }
      : null,
    annual_rainfall:
      daily.length > 3000
        ? { value: Math.round(daily.reduce((s, v) => s + v, 0) / 10), unit: 'mm/year', source: 'ERA5 reanalysis via Open-Meteo, 10-year average', confidence: 'estimated', note: null }
        : null,
    seismic_zone: null,
    wind_speed: null,
    soil: null,
    constraints: [],
    unavailable: ['roads, design zones and soil (need the full app, not the demo)', ...(h ? [] : ['ground levels']), ...(daily.length > 3000 ? [] : ['rainfall'])],
  }
}

/** Demo mode's neighbouring buildings: OpenStreetMap's Overpass, asked straight from the browser. */
async function buildings(lat: number, lng: number, radius: number) {
  const query = `[out:json][timeout:15];way(around:${Math.min(300, Math.max(20, radius))},${lat},${lng})[building];out tags geom;`
  let data: { elements?: { id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }[] }
  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: query }) })
    if (!response.ok) throw new Error(String(response.status))
    data = await response.json()
  } catch {
    throw new ApiError(502, 'Neighbouring buildings are unavailable right now. Try again.')
  }
  const number = (v?: string) => (v ? Number.parseFloat(v) : Number.NaN)
  return {
    type: 'FeatureCollection',
    features: (data.elements ?? [])
      .filter((w) => (w.geometry?.length ?? 0) >= 4)
      .map((w) => {
        const tags = w.tags ?? {}
        const mapped = number(tags.height)
        const levels = number(tags['building:levels'])
        const [height, basis] = mapped > 0 ? [mapped, 'mapped'] : levels > 0 ? [levels * 3.2 + 0.6, 'levels'] : [7, 'estimated']
        const ring = w.geometry!.map((p) => [p.lon, p.lat])
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ring.push(ring[0])
        return { type: 'Feature', id: w.id, properties: { height_m: Math.round(height * 10) / 10, basis, name: tags.name ?? null }, geometry: { type: 'Polygon', coordinates: [ring] } }
      }),
  }
}

export async function handleDemoGeo(segments: string[], params: URLSearchParams, body: Record<string, unknown> = {}): Promise<unknown> {
  const [, action, id] = segments
  if (action === 'site-report') return siteReport(body)
  if (action === 'config') {
    return {
      search_provider: 'open',
      satellite: {
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
        max_zoom: 19,
      },
      streets: { tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attribution: '© OpenStreetMap contributors', max_zoom: 19 },
      terrain: {
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        attribution: 'Terrain: AWS Terrain Tiles (SRTM, GMTED and others)',
        max_zoom: 15,
        encoding: 'terrarium',
      },
    }
  }
  if (action === 'buildings') return buildings(Number(params.get('lat')), Number(params.get('lng')), Number(params.get('radius') ?? 150))
  if (action === 'autocomplete') return autocomplete(params.get('q') ?? '', params.get('country'))
  if (action === 'places' && id) {
    const osmId = decodeURIComponent(id).replace(/^osm:/, '')
    if (!OSM_TYPES.has(osmId[0]) || !/^\d+$/.test(osmId.slice(1))) throw new ApiError(502, 'Unknown place.')
    const data = (await getJson(`${NOMINATIM}/lookup?${new URLSearchParams({ osm_ids: osmId, format: 'jsonv2', addressdetails: '1' })}`)) as NominatimResult[]
    if (!data.length) throw new ApiError(502, "That place couldn't be found.")
    return toPlace(data[0])
  }
  if (action === 'reverse') {
    const lat = Number(params.get('lat'))
    const lng = Number(params.get('lng'))
    const data = (await getJson(
      `${NOMINATIM}/reverse?${new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'jsonv2', addressdetails: '1', zoom: '18' })}`,
    )) as NominatimResult
    if (data.error) return toPlace({ lat: String(lat), lon: String(lng) }, lat, lng)
    return toPlace(data, lat, lng)
  }
  throw new ApiError(404, 'Not Found')
}
