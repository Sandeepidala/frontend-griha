import { apiRequest } from '../apiClient'

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

export interface MapConfig {
  searchProvider: 'google' | 'open'
  satellite: TileSource
  streets: TileSource
}

interface MapConfigDto {
  search_provider: MapConfig['searchProvider']
  satellite: { tiles: string[]; attribution: string; max_zoom: number }
  streets: { tiles: string[]; attribution: string; max_zoom: number }
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
  return { searchProvider: dto.search_provider, satellite: source(dto.satellite), streets: source(dto.streets) }
}
