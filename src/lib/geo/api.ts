import { apiRequest } from '../apiClient'
import type { LatLng } from '@/types/project'
import type { SiteReport } from '@/types/site'

/** Location search through the backend's /geo gateway (Google Places, or OpenStreetMap without a key). */

export interface GeoSuggestion {
  id: string
  title: string
  subtitle: string
}

export interface GeoPlaceDto {
  id: string
  provider: string
  formatted_address: string
  lat: number
  lng: number
  country: string | null
  country_code: string | null
  state: string | null
  city: string | null
  postcode: string | null
  locality: string | null
}

export interface GeoPlace {
  id: string
  provider: 'google' | 'open'
  formattedAddress: string
  lat: number
  lng: number
  country: string | null
  countryCode: string | null
  state: string | null
  city: string | null
  postcode: string | null
  locality: string | null
}

export interface TileSource {
  tiles: string[]
  attribution: string
  maxZoom: number
}

export interface TerrainSource extends TileSource {
  encoding: 'terrarium' | 'mapbox'
}

export interface MapConfig {
  searchProvider: 'google' | 'open'
  satellite: TileSource
  streets: TileSource
  terrain: TerrainSource
}

interface MapConfigDto {
  search_provider: MapConfig['searchProvider']
  satellite: { tiles: string[]; attribution: string; max_zoom: number }
  streets: { tiles: string[]; attribution: string; max_zoom: number }
  /** Missing from backends deployed before the 3D site view. */
  terrain?: { tiles: string[]; attribution: string; max_zoom: number; encoding: TerrainSource['encoding'] }
}

const DEFAULT_TERRAIN: TerrainSource = {
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  attribution: 'Terrain: AWS Terrain Tiles (SRTM, GMTED and others)',
  maxZoom: 15,
  encoding: 'terrarium',
}

export function mapPlace(dto: GeoPlaceDto): GeoPlace {
  return {
    id: dto.id,
    provider: dto.provider === 'google' ? 'google' : 'open',
    formattedAddress: dto.formatted_address,
    lat: dto.lat,
    lng: dto.lng,
    country: dto.country,
    countryCode: dto.country_code,
    state: dto.state,
    city: dto.city,
    postcode: dto.postcode,
    locality: dto.locality,
  }
}

const query = (params: Record<string, string | number | undefined | null>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '') as [string, string][]).toString()

/** A new token per search, ended by the place lookup: Google bills that as one session. */
export function newSearchSession() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function searchPlaces(text: string, session: string, country?: string): Promise<GeoSuggestion[]> {
  return apiRequest<GeoSuggestion[]>(`/geo/autocomplete?${query({ q: text, session, country })}`)
}

export async function placeDetails(id: string, session: string): Promise<GeoPlace> {
  return mapPlace(await apiRequest<GeoPlaceDto>(`/geo/places/${encodeURIComponent(id)}?${query({ session })}`))
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeoPlace> {
  return mapPlace(await apiRequest<GeoPlaceDto>(`/geo/reverse?${query({ lat, lng })}`))
}

export async function getMapConfig(): Promise<MapConfig> {
  const dto = await apiRequest<MapConfigDto>('/geo/config')
  const source = (s: MapConfigDto['satellite']): TileSource => ({ tiles: s.tiles, attribution: s.attribution, maxZoom: s.max_zoom })
  return {
    searchProvider: dto.search_provider,
    satellite: source(dto.satellite),
    streets: source(dto.streets),
    terrain: dto.terrain ? { ...source(dto.terrain), encoding: dto.terrain.encoding } : DEFAULT_TERRAIN,
  }
}

export interface SiteReportRequest {
  lat: number
  lng: number
  boundary: LatLng[] | null
  roadEdge: number | null
  city: string | null
  state: string | null
  countryCode: string | null
}

/** Roads, terrain, rainfall, design zones, soil and nearby constraints for a marked plot (5–25 s). */
export async function fetchSiteReport(input: SiteReportRequest): Promise<SiteReport> {
  return apiRequest<SiteReport>('/geo/site-report', {
    method: 'POST',
    body: {
      lat: input.lat,
      lng: input.lng,
      boundary: input.boundary,
      road_edge: input.roadEdge,
      city: input.city,
      state: input.state,
      country_code: input.countryCode,
    },
  })
}

export interface NeighbourBuilding {
  type: 'Feature'
  id: number
  properties: { height_m: number; basis: 'mapped' | 'levels' | 'estimated'; name: string | null }
  geometry: { type: 'Polygon'; coordinates: [number, number][][] }
}

/** Buildings around the plot from OpenStreetMap, each with a height in metres (mapped or estimated). */
export async function fetchBuildings(lat: number, lng: number, radius = 150): Promise<{ type: 'FeatureCollection'; features: NeighbourBuilding[] }> {
  return apiRequest(`/geo/buildings?${query({ lat: lat.toFixed(5), lng: lng.toFixed(5), radius })}`)
}
