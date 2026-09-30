import { Check, Loader2, MapPin, RotateCcw, Search, X } from 'lucide-react'
import { GeoJSONSource, Map as MapLibre, Marker, NavigationControl, type MapMouseEvent, type StyleSpecification } from '@/lib/geo/maplibre'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ApiError } from '@/lib/apiError'
import { type GeoPlace, type GeoSuggestion, type MapConfig, getMapConfig, newSearchSession, placeDetails, reverseGeocode, searchPlaces } from '@/lib/geo/api'
import { type PlotFromBoundary, plotFromBoundary } from '@/lib/geo/plot'
import { formatFeet } from '@/lib/drawings/geometry'
import type { LatLng, SiteLocation } from '@/types/project'

interface LocationPickerProps {
  value: SiteLocation | null
  onChange: (site: SiteLocation | null) => void
  /** Applies what the drawn boundary says about the plot (size, facing, shape) to the brief. */
  onUsePlot: (plot: PlotFromBoundary) => void
}

type Step = 'pin' | 'corners' | 'road' | 'done'
type Basemap = 'satellite' | 'streets'

const EMPTY = { type: 'FeatureCollection' as const, features: [] }
const INDIA = { lat: 22.5, lng: 79 }

function styleFor(config: MapConfig): StyleSpecification {
  const raster = (source: MapConfig['satellite']) => ({ type: 'raster' as const, tiles: source.tiles, tileSize: 256, attribution: source.attribution, maxzoom: source.maxZoom })
  return {
    version: 8,
    sources: {
      satellite: raster(config.satellite),
      streets: raster(config.streets),
      plot: { type: 'geojson', data: EMPTY },
      edges: { type: 'geojson', data: EMPTY },
      corners: { type: 'geojson', data: EMPTY },
    },
    layers: [
      { id: 'satellite', type: 'raster', source: 'satellite' },
      { id: 'streets', type: 'raster', source: 'streets', layout: { visibility: 'none' } },
      { id: 'plot-fill', type: 'fill', source: 'plot', paint: { 'fill-color': '#f5c542', 'fill-opacity': 0.18 } },
      {
        id: 'edges',
        type: 'line',
        source: 'edges',
        paint: {
          'line-color': ['case', ['get', 'road'], '#e53935', ['get', 'hover'], '#ffd54f', '#ffffff'],
          'line-width': ['case', ['get', 'road'], 6, 3],
        },
      },
      { id: 'corners', type: 'circle', source: 'corners', paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#1d1d1f', 'circle-stroke-width': 2 } },
    ],
  }
}

function siteFromPlace(place: GeoPlace): SiteLocation {
  return {
    provider: place.provider,
    placeId: place.id || null,
    formattedAddress: place.formattedAddress || null,
    lat: place.lat,
    lng: place.lng,
    country: place.country,
    countryCode: place.countryCode,
    state: place.state,
    city: place.city,
    postcode: place.postcode,
    locality: place.locality,
    boundary: null,
    roadEdge: null,
    rotationDeg: null,
    origin: null,
  }
}

function message(err: unknown) {
  return err instanceof ApiError ? err.message : 'Location search is unavailable right now.'
}

/**
 * Finds the plot on a satellite map: search an address, drop the pin on the plot, click its corners
 * and pick the side on the road. The plot's size, facing and shape are then read off the map.
 */
export function LocationPicker({ value, onChange, onUsePlot }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const [config, setConfig] = useState<MapConfig | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [basemap, setBasemap] = useState<Basemap>('satellite')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const sessionRef = useRef(newSearchSession())
  // The text of the suggestion just chosen: shown in the box, but not searched again.
  const chosenRef = useRef<string | null>(null)
  const [corners, setCorners] = useState<LatLng[]>(value?.boundary ?? [])
  const [roadEdge, setRoadEdge] = useState<number | null>(value?.roadEdge ?? null)
  const [step, setStep] = useState<Step>(value?.boundary && value.roadEdge !== null ? 'done' : 'pin')
  const [hoverEdge, setHoverEdge] = useState<number | null>(null)
  // The latest values for map event handlers, which are registered once.
  const live = useRef({ step, corners, value, onChange })
  live.current = { step, corners, value, onChange }

  const derived = corners.length >= 3 && roadEdge !== null ? plotFromBoundary(corners, roadEdge) : null

  useEffect(() => {
    let cancelled = false
    getMapConfig()
      .then((c) => !cancelled && setConfig(c))
      .catch((err) => !cancelled && setMapError(message(err)))
    return () => {
      cancelled = true
    }
  }, [])

  // Create the map once the tile configuration is known.
  useEffect(() => {
    if (!config || !containerRef.current || mapRef.current) return
    const start = live.current.value ?? INDIA
    const map = new MapLibre({
      container: containerRef.current,
      style: styleFor(config),
      center: [start.lng, start.lat],
      zoom: live.current.value ? 18 : 4,
      // Past the imagery's deepest level the last tiles are enlarged, so small plots can still be clicked precisely.
      maxZoom: config.satellite.maxZoom + 3,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ showCompass: true, visualizePitch: false }), 'top-right')
    mapRef.current = map

    map.on('click', (event: MapMouseEvent) => {
      const { step: current, corners: points } = live.current
      const point = { lat: event.lngLat.lat, lng: event.lngLat.lng }
      if (current === 'corners') {
        const next = [...points, point]
        setCorners(next)
        if (next.length === 4) setStep('road')
        return
      }
      if (current === 'road') {
        const hit = map.queryRenderedFeatures(event.point, { layers: ['edges'] })[0]
        if (hit) {
          setRoadEdge(Number(hit.properties?.index))
          setStep('done')
        }
        return
      }
      if (current === 'pin') void placePin(point)
    })
    map.on('mousemove', 'edges', (event) => {
      if (live.current.step !== 'road') return
      map.getCanvas().style.cursor = 'pointer'
      setHoverEdge(Number(event.features?.[0]?.properties?.index))
    })
    map.on('mouseleave', 'edges', () => {
      map.getCanvas().style.cursor = ''
      setHoverEdge(null)
    })
    map.on('error', (event) => {
      // Tile hiccups are routine; only report when the map can't start at all.
      if (!map.loaded()) setMapError(event.error?.message ?? 'The map could not load.')
    })
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // placePin only uses refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config])

  // Keep the marker on the chosen location.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !value) return
    if (!markerRef.current) {
      markerRef.current = new Marker({ color: '#e53935', draggable: true }).setLngLat([value.lng, value.lat]).addTo(map)
      markerRef.current.on('dragend', () => {
        const at = markerRef.current!.getLngLat()
        void placePin({ lat: at.lat, lng: at.lng })
      })
    } else {
      markerRef.current.setLngLat([value.lng, value.lat])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, config])

  // Draw the boundary, its sides (the road side in red) and the corners.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const draw = () => {
      const ring = corners.map((c) => [c.lng, c.lat] as [number, number])
      const closed = corners.length >= 3 && step !== 'corners'
      ;(map.getSource('plot') as GeoJSONSource | undefined)?.setData(
        closed ? { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } } : EMPTY,
      )
      const edgeCount = closed ? corners.length : Math.max(0, corners.length - 1)
      ;(map.getSource('edges') as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection',
        features: Array.from({ length: edgeCount }, (_, i) => ({
          type: 'Feature' as const,
          properties: { index: i, road: i === roadEdge, hover: i === hoverEdge },
          geometry: { type: 'LineString' as const, coordinates: [ring[i], ring[(i + 1) % ring.length]] },
        })),
      })
      ;(map.getSource('corners') as GeoJSONSource | undefined)?.setData({
        type: 'FeatureCollection',
        features: ring.map((c) => ({ type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: c } })),
      })
    }
    if (map.isStyleLoaded()) draw()
    else map.once('load', draw)
  }, [corners, roadEdge, hoverEdge, step, config])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      map.setLayoutProperty('satellite', 'visibility', basemap === 'satellite' ? 'visible' : 'none')
      map.setLayoutProperty('streets', 'visibility', basemap === 'streets' ? 'visible' : 'none')
    }
    if (map.isStyleLoaded()) apply()
    else map.once('load', apply)
  }, [basemap])

  // Type-ahead, a moment after typing stops.
  useEffect(() => {
    const text = query.trim()
    if (text.length < 2 || text === chosenRef.current) {
      setSuggestions([])
      return
    }
    const timer = window.setTimeout(() => {
      setSearching(true)
      searchPlaces(text, sessionRef.current)
        .then((found) => {
          setSuggestions(found)
          setSearchError(found.length ? null : 'No matches. Try a locality and city, e.g. "Jayanagar Bengaluru".')
        })
        .catch((err) => setSearchError(message(err)))
        .finally(() => setSearching(false))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [query])

  async function choose(suggestion: GeoSuggestion) {
    setSuggestions([])
    chosenRef.current = suggestion.title
    setQuery(suggestion.title)
    try {
      const place = await placeDetails(suggestion.id, sessionRef.current)
      sessionRef.current = newSearchSession()
      resetBoundary()
      onChange(siteFromPlace(place))
      mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: 18, essential: true })
    } catch (err) {
      setSearchError(message(err))
    }
  }

  /** Moves the pin and looks up the address there (the plot itself, not the searched locality). */
  async function placePin(point: LatLng) {
    const current = live.current.value
    const provisional: SiteLocation = current
      ? { ...current, lat: point.lat, lng: point.lng }
      : {
          ...siteFromPlace({ id: '', provider: 'open', formattedAddress: '', ...point, country: null, countryCode: null, state: null, city: null, postcode: null, locality: null }),
          provider: 'manual',
        }
    live.current.onChange(provisional)
    try {
      const place = await reverseGeocode(point.lat, point.lng)
      const base = live.current.value ?? provisional
      live.current.onChange({
        ...base,
        formattedAddress: place.formattedAddress || base.formattedAddress,
        country: place.country ?? base.country,
        countryCode: place.countryCode ?? base.countryCode,
        state: place.state ?? base.state,
        city: place.city ?? base.city,
        postcode: place.postcode ?? base.postcode,
        locality: place.locality ?? base.locality,
      })
    } catch {
      // The pin still counts without an address.
    }
  }

  function resetBoundary() {
    setCorners([])
    setRoadEdge(null)
    setStep('pin')
  }

  function startCorners() {
    setCorners([])
    setRoadEdge(null)
    setStep('corners')
  }

  // Record the boundary on the site once it's complete.
  useEffect(() => {
    if (!value || step !== 'done' || !derived || roadEdge === null) return
    const same =
      value.roadEdge === roadEdge && value.boundary?.length === corners.length && value.boundary.every((c, i) => c.lat === corners[i].lat && c.lng === corners[i].lng)
    if (same) return
    onChange({ ...value, boundary: corners, roadEdge, rotationDeg: derived.rotationDeg, origin: derived.origin })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, roadEdge, corners])

  const hint = {
    pin: value ? 'Drag the pin, or click the map, to put it on your plot. Then mark the corners to measure it.' : 'Search for the address, or click the map where the plot is.',
    corners: `Click the plot's corners in order around it (${corners.length} of 4).`,
    road: 'Now click the side of the plot that is on the road.',
    done: 'Plot measured. Adjust by marking the corners again.',
  }[step]

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the address, area or landmark"
          leftSlot={searching ? <Loader2 className="animate-spin" /> : <Search />}
          aria-label="Search for the plot's location"
          autoComplete="off"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="absolute top-1/2 right-2.5 -translate-y-1/2 text-text-faint hover:text-text" aria-label="Clear search">
            <X className="size-4" />
          </button>
        )}
        {suggestions.length > 0 && (
          <ul role="listbox" className="absolute top-full right-0 left-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button type="button" role="option" aria-selected="false" onClick={() => void choose(s)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-text-faint" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-text">{s.title}</span>
                    {s.subtitle && <span className="block truncate text-xs text-text-muted">{s.subtitle}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {searchError && <p className="text-xs text-warning">{searchError}</p>}

      <div className="relative h-72 overflow-hidden rounded-md border border-border bg-surface-2">
        {mapError ? (
          <p className="flex h-full items-center justify-center p-4 text-center text-sm text-text-muted">{mapError}</p>
        ) : (
          <div ref={containerRef} className="h-full w-full" data-testid="site-map" />
        )}
        <div className="absolute top-2 left-2 rounded-md bg-surface/90 shadow-sm">
          <SegmentedControl<Basemap>
            value={basemap}
            onChange={setBasemap}
            options={[
              { value: 'satellite', label: 'Satellite' },
              { value: 'streets', label: 'Map' },
            ]}
          />
        </div>
      </div>
      <p className="text-xs text-text-muted">{hint}</p>

      {value && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 px-3 py-2.5">
          <p className="flex items-start gap-1.5 text-sm text-text">
            <MapPin className="mt-0.5 size-4 shrink-0 text-danger" />
            <span>{value.formattedAddress || `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`}</span>
          </p>
          {derived && step === 'done' && (
            <p className="text-sm text-text-muted">
              Measured: <span className="font-medium text-text">{formatFeet(derived.frontageFt)} frontage × {formatFeet(derived.depthFt)} deep</span>,{' '}
              {derived.facing}-facing{Math.abs(derived.rotationDeg) >= 1 ? ` (turned ${Math.abs(derived.rotationDeg)}° ${derived.rotationDeg > 0 ? 'clockwise' : 'anticlockwise'})` : ''}, about{' '}
              {derived.areaSqft.toLocaleString('en-IN')} sq ft{derived.shape !== 'rectangular' ? `, ${derived.shape}` : ''}.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {step !== 'corners' && step !== 'road' && (
              <Button size="sm" variant="outline" onClick={startCorners}>
                {corners.length ? 'Mark corners again' : 'Mark plot corners'}
              </Button>
            )}
            {(step === 'corners' || step === 'road') && (
              <Button size="sm" variant="ghost" leftIcon={<RotateCcw className="size-4" />} onClick={resetBoundary}>
                Cancel
              </Button>
            )}
            {derived && step === 'done' && (
              <Button size="sm" leftIcon={<Check className="size-4" />} onClick={() => onUsePlot(derived)}>
                Use these plot details
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-text-muted"
              onClick={() => {
                resetBoundary()
                onChange(null)
                setQuery('')
              }}
            >
              Remove location
            </Button>
          </div>
        </div>
      )}
      {config && (
        <p className="text-[11px] text-text-faint">
          {config.searchProvider === 'google' ? 'Search by Google.' : 'Search © OpenStreetMap contributors (Photon, Nominatim).'} Satellite imagery can be a few years old;
          check boundaries against your sale deed.
        </p>
      )}
    </div>
  )
}
