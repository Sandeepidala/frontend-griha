import { Sun } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { ApiError } from '@/lib/apiError'
import { type FloorModel, PARAPET_HEIGHT, PLINTH_HEIGHT } from '@/lib/drawings/geometry'
import { buildingBoxes } from '@/lib/drawings/massing'
import { type MapConfig, type NeighbourBuilding, fetchBuildings } from '@/lib/geo/api'
import { GeoJSONSource, Map as MapLibre, NavigationControl, type StyleSpecification } from '@/lib/geo/maplibre'
import { type LatLng, fromLocal, planRectToRing, planToLatLng, toLocal } from '@/lib/geo/plot'
import { dayOfYear, shadowOf, sunPosition, utcOffsetFor } from '@/lib/geo/sun'
import type { SiteLocation } from '@/types/project'

const FT = 0.3048
const EMPTY = { type: 'FeatureCollection' as const, features: [] }
const SEASONS = {
  summer: { label: 'Summer (21 Jun)', doy: dayOfYear(6, 21) },
  equinox: { label: 'Equinox (21 Mar)', doy: dayOfYear(3, 21) },
  winter: { label: 'Winter (21 Dec)', doy: dayOfYear(12, 21) },
}
type Season = keyof typeof SEASONS

type Placed = SiteLocation & { origin: LatLng }
type Ring = [number, number][]

interface PolygonFeature {
  type: 'Feature'
  properties: Record<string, string | number | boolean>
  geometry: { type: 'Polygon'; coordinates: Ring[] }
}

function polygon(ring: Ring, properties: PolygonFeature['properties'] = {}): PolygonFeature {
  return { type: 'Feature', properties, geometry: { type: 'Polygon', coordinates: [ring] } }
}

/** Ray casting: is a lng/lat point inside a lng/lat ring? */
function inside(point: [number, number], ring: Ring) {
  let hit = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > point[1] !== yj > point[1] && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

function style(config: MapConfig): StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: { type: 'raster', tiles: config.satellite.tiles, tileSize: 256, attribution: config.satellite.attribution, maxzoom: config.satellite.maxZoom },
      terrain: { type: 'raster-dem', tiles: config.terrain.tiles, tileSize: 256, encoding: config.terrain.encoding, maxzoom: config.terrain.maxZoom, attribution: config.terrain.attribution },
      boundary: { type: 'geojson', data: EMPTY },
      shadows: { type: 'geojson', data: EMPTY },
      neighbours: { type: 'geojson', data: EMPTY, attribution: '© OpenStreetMap contributors' },
      house: { type: 'geojson', data: EMPTY },
    },
    layers: [
      { id: 'satellite', type: 'raster', source: 'satellite' },
      { id: 'shadows', type: 'fill', source: 'shadows', paint: { 'fill-color': '#000000', 'fill-opacity': 0.3 } },
      { id: 'boundary', type: 'line', source: 'boundary', paint: { 'line-color': '#ffd54f', 'line-width': 2, 'line-dasharray': [3, 2] } },
      {
        id: 'neighbours',
        type: 'fill-extrusion',
        source: 'neighbours',
        paint: {
          'fill-extrusion-color': ['case', ['==', ['get', 'basis'], 'estimated'], '#bdb8b0', '#a9a49b'],
          'fill-extrusion-height': ['get', 'height_m'],
          'fill-extrusion-opacity': 0.85,
        },
      },
      {
        id: 'house',
        type: 'fill-extrusion',
        source: 'house',
        filter: ['!', ['get', 'glass']],
        paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'height'] },
      },
      {
        id: 'house-glass',
        type: 'fill-extrusion',
        source: 'house',
        filter: ['get', 'glass'],
        paint: { 'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-base': ['get', 'base'], 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-opacity': 0.7 },
      },
    ],
  }
}

interface Site3DViewProps {
  site: Placed
  models: FloorModel[]
  config: MapConfig
}

/**
 * The design in 3D on its real site: the building (walls, windows, slabs, parapet) extruded at its
 * true position and turn, neighbouring buildings from OpenStreetMap, optional terrain, and a sun study
 * with ground shadows for any season and time of day.
 */
export function Site3DView({ site, models, config }: Site3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [season, setSeason] = useState<Season>('winter')
  const [hour, setHour] = useState(10)
  const [shadows, setShadows] = useState(true)
  const [showNeighbours, setShowNeighbours] = useState(true)
  const [terrain, setTerrain] = useState(false)
  const [neighbours, setNeighbours] = useState<NeighbourBuilding[] | null>(null)
  const [neighbourError, setNeighbourError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const frame = useMemo(() => ({ origin: site.origin, rotationDeg: site.rotationDeg ?? 0 }), [site.origin, site.rotationDeg])
  const boundaryRing = useMemo<Ring | null>(() => (site.boundary ? [...site.boundary.map((c) => [c.lng, c.lat] as [number, number]), [site.boundary[0].lng, site.boundary[0].lat]] : null), [site.boundary])

  const house = useMemo(
    () =>
      buildingBoxes(models).map((box) =>
        polygon(planRectToRing(frame, box.rect), { base: box.z0 * FT, height: box.z1 * FT, color: box.color, glass: Boolean(box.opacity) }),
      ),
    [models, frame],
  )
  // Neighbours standing on the plot itself are what the new house replaces.
  const around = useMemo(
    () =>
      (neighbours ?? []).filter((b) => {
        if (!boundaryRing) return true
        const ring = b.geometry.coordinates[0]
        const c: [number, number] = [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]
        return !inside(c, boundaryRing)
      }),
    [neighbours, boundaryRing],
  )

  const offset = utcOffsetFor(site.countryCode, site.lng)
  const sun = sunPosition(site.lat, site.lng, SEASONS[season].doy, hour, offset)

  const shadowFeatures = useMemo(() => {
    if (!shadows) return []
    const local = (lng: number, lat: number): [number, number] => {
      const d = toLocal(site.origin, { lat, lng })
      return [d.east, d.north]
    }
    const back = (ring: [number, number][]) => {
      const out = ring.map(([e, n]) => {
        const p = fromLocal(site.origin, e, n)
        return [p.lng, p.lat] as [number, number]
      })
      return [...out, out[0]]
    }
    const features: PolygonFeature[] = []
    // Each floor's outline at its roof (parapet on the top floor), lifted on the plinth.
    models.forEach((model, i) => {
      if (!model.footprint) return
      const top = (model.floor.elevation + model.height + PLINTH_HEIGHT + (i === models.length - 1 ? PARAPET_HEIGHT : 0)) * FT
      const ring = planRectToRing(frame, model.footprint).slice(0, 4).map(([lng, lat]) => local(lng, lat))
      const shadow = shadowOf(ring, top, sun)
      if (shadow) features.push(polygon(back(shadow)))
    })
    if (showNeighbours) {
      for (const b of around) {
        const ring = b.geometry.coordinates[0].slice(0, -1).map(([lng, lat]) => local(lng, lat))
        const shadow = shadowOf(ring, b.properties.height_m, sun)
        if (shadow) features.push(polygon(back(shadow)))
      }
    }
    return features
    // The sun is fully described by these numbers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shadows, showNeighbours, around, models, frame, site.origin, sun.azimuth, sun.altitude])

  useEffect(() => {
    let current = true
    fetchBuildings(site.lat, site.lng)
      .then((fc) => current && (setNeighbours(fc.features), setNeighbourError(null)))
      .catch((err) => current && setNeighbourError(err instanceof ApiError ? err.message : 'Neighbouring buildings are unavailable right now.'))
    return () => {
      current = false
    }
  }, [site.lat, site.lng, attempt])

  useEffect(() => {
    if (!containerRef.current) return
    // Frame the house: its ground floor's middle, close enough to read the facades.
    const fp = models[0]?.footprint
    const middle = fp ? planToLatLng(frame, fp.x + fp.width / 2, fp.y + fp.height / 2) : { lat: site.lat, lng: site.lng }
    const map = new MapLibre({
      container: containerRef.current,
      style: style(config),
      center: [middle.lng, middle.lat],
      zoom: config.satellite.maxZoom + 1.5,
      pitch: 60,
      bearing: -25,
      maxPitch: 80,
      maxZoom: config.satellite.maxZoom + 3,
      attributionControl: { compact: true },
    })
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right')
    map.once('load', () => setLoaded(true))
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      setLoaded(false)
    }
    // The map is built once per site; layers are updated below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, site.lat, site.lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    ;(map.getSource('house') as GeoJSONSource).setData({ type: 'FeatureCollection', features: house })
    ;(map.getSource('boundary') as GeoJSONSource).setData(boundaryRing ? polygon(boundaryRing) : EMPTY)
  }, [loaded, house, boundaryRing])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    ;(map.getSource('neighbours') as GeoJSONSource).setData({ type: 'FeatureCollection', features: showNeighbours ? (around as unknown as PolygonFeature[]) : [] })
  }, [loaded, around, showNeighbours])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    ;(map.getSource('shadows') as GeoJSONSource).setData({ type: 'FeatureCollection', features: shadowFeatures })
    // Light the facades from the sun's direction; at night, a soft light from overhead.
    map.setLight({ anchor: 'map', position: [1.15, sun.azimuth, Math.min(90, Math.max(0, 90 - sun.altitude))], intensity: sun.altitude > 0 ? 0.55 : 0.2 })
  }, [loaded, shadowFeatures, sun.azimuth, sun.altitude])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded) return
    map.setTerrain(terrain ? { source: 'terrain', exaggeration: 1 } : null)
  }, [loaded, terrain])

  const estimated = around.filter((b) => b.properties.basis === 'estimated').length
  const clock = `${Math.floor(hour)}:${hour % 1 ? '30' : '00'}`

  return (
    <div className="relative h-full">
      <div ref={containerRef} className="h-full w-full" data-testid="site-3d-map" />
      <div className="absolute bottom-8 left-3 flex w-80 max-w-[calc(100%-1.5rem)] flex-col gap-2.5 rounded-md bg-surface/95 p-3 text-xs text-text-muted shadow-md">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
          <Sun className="size-4 text-warning" /> Sun study
        </p>
        <SegmentedControl<Season>
          value={season}
          onChange={setSeason}
          options={(Object.keys(SEASONS) as Season[]).map((value) => ({ value, label: SEASONS[value].label.split(' (')[0] }))}
          className="grid w-full grid-cols-3"
        />
        <label className="flex items-center gap-2">
          <span className="w-10 font-mono text-text tabular-nums">{clock}</span>
          <input type="range" min={6} max={18.5} step={0.5} value={hour} onChange={(e) => setHour(Number(e.target.value))} className="flex-1" aria-label="Time of day" />
        </label>
        <p>
          {SEASONS[season].label}, {clock} ({offset === 5.5 ? 'IST' : `UTC${offset >= 0 ? '+' : ''}${offset}`}):{' '}
          {sun.altitude > 0 ? `sun ${Math.round(sun.altitude)}° up, from ${Math.round(sun.azimuth)}°` : 'the sun is down'}.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <label className="flex items-center gap-1.5">
            <Switch checked={shadows} onChange={(e) => setShadows(e.target.checked)} aria-label="Shadows" /> Shadows
          </label>
          <label className="flex items-center gap-1.5">
            <Switch checked={showNeighbours} onChange={(e) => setShowNeighbours(e.target.checked)} aria-label="Neighbouring buildings" /> Neighbours
          </label>
          <label className="flex items-center gap-1.5">
            <Switch checked={terrain} onChange={(e) => setTerrain(e.target.checked)} aria-label="Terrain" /> Terrain
          </label>
        </div>
        {neighbourError ? (
          <p className="flex items-center justify-between gap-2 text-warning">
            {neighbourError}
            <Button size="sm" variant="ghost" onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </Button>
          </p>
        ) : neighbours ? (
          <p>
            {around.length} neighbouring buildings from OpenStreetMap{estimated ? `; ${estimated} heights estimated (G+1)` : ''}. Drag with right-click (or two
            fingers) to tilt and turn.
          </p>
        ) : (
          <p>Loading neighbouring buildings from OpenStreetMap (can take up to half a minute)…</p>
        )}
      </div>
    </div>
  )
}
