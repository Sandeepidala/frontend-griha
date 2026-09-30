import { ApiError } from '../apiError'
import type { GeoPlaceDto, GeoSuggestion } from '../geo/api'

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

export async function handleDemoGeo(segments: string[], params: URLSearchParams): Promise<unknown> {
  const [, action, id] = segments
  if (action === 'config') {
    return {
      search_provider: 'open',
      satellite: {
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
        max_zoom: 19,
      },
      streets: { tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attribution: '© OpenStreetMap contributors', max_zoom: 19 },
    }
  }
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
