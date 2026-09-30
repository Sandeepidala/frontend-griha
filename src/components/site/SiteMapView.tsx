import { MapPinned } from 'lucide-react'
import { GeoJSONSource, LngLatBounds, Map as MapLibre, Marker, NavigationControl, ScaleControl, type StyleSpecification } from '@/lib/geo/maplibre'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState } from '@/components/widgets/EmptyState'
import { ApiError } from '@/lib/apiError'
import { type FloorModel, buildBuildingModel, wallRect } from '@/lib/drawings/geometry'
import { type MapConfig, getMapConfig } from '@/lib/geo/api'
import { planRectToRing } from '@/lib/geo/plot'
import { useDesignStore } from '@/stores/useDesignStore'
import { useActiveProject, useProjectsStore } from '@/stores/useProjectsStore'
import type { SiteLocation } from '@/types/project'

type Basemap = 'satellite' | 'streets'
const EMPTY = { type: 'FeatureCollection' as const, features: [] }

type Placed = SiteLocation & { origin: NonNullable<SiteLocation['origin']> }

interface PolygonFeature {
  type: 'Feature'
  properties: Record<string, string | number>
  geometry: { type: 'Polygon'; coordinates: [number, number][][] }
}

function footprintFeatures(site: Placed, models: FloorModel[]) {
  const frame = { origin: site.origin, rotationDeg: site.rotationDeg ?? 0 }
  const features: PolygonFeature[] = []
  models.forEach((model, level) => {
    // Rooms and walls of the lowest floor fill the footprint; upper floors show as outlines.
    for (const room of model.rooms) {
      features.push({
        type: 'Feature',
        properties: { level, kind: 'room', name: level === 0 ? room.name : '' },
        geometry: { type: 'Polygon', coordinates: [planRectToRing(frame, room)] },
      })
    }
    if (level === 0) {
      for (const wall of model.walls) {
        features.push({ type: 'Feature', properties: { level, kind: 'wall' }, geometry: { type: 'Polygon', coordinates: [planRectToRing(frame, wallRect(wall))] } })
      }
    }
  })
  return { type: 'FeatureCollection' as const, features }
}

function style(config: MapConfig): StyleSpecification {
  const raster = (s: MapConfig['satellite']) => ({ type: 'raster' as const, tiles: s.tiles, tileSize: 256, attribution: s.attribution, maxzoom: s.maxZoom })
  return {
    version: 8,
    sources: {
      satellite: raster(config.satellite),
      streets: raster(config.streets),
      boundary: { type: 'geojson', data: EMPTY },
      plan: { type: 'geojson', data: EMPTY },
    },
    layers: [
      { id: 'satellite', type: 'raster', source: 'satellite' },
      { id: 'streets', type: 'raster', source: 'streets', layout: { visibility: 'none' } },
      { id: 'boundary-fill', type: 'fill', source: 'boundary', paint: { 'fill-color': '#f5c542', 'fill-opacity': 0.12 } },
      { id: 'boundary-line', type: 'line', source: 'boundary', paint: { 'line-color': '#ffd54f', 'line-width': 2, 'line-dasharray': [3, 2] } },
      {
        id: 'rooms',
        type: 'fill',
        source: 'plan',
        filter: ['all', ['==', ['get', 'kind'], 'room'], ['==', ['get', 'level'], 0]],
        paint: { 'fill-color': '#ffffff', 'fill-opacity': 0.72 },
      },
      { id: 'walls', type: 'fill', source: 'plan', filter: ['==', ['get', 'kind'], 'wall'], paint: { 'fill-color': '#3f3f46' } },
      {
        id: 'upper',
        type: 'line',
        source: 'plan',
        filter: ['all', ['==', ['get', 'kind'], 'room'], ['>', ['get', 'level'], 0]],
        paint: { 'line-color': '#e53935', 'line-width': 1.5, 'line-dasharray': [2, 2] },
      },
    ],
  }
}

/**
 * The plan on the real site: the ground floor drawn to scale on satellite imagery, inside the
 * boundary marked on the map, with upper floors dashed. Lets the customer see the house on their
 * land, with the neighbours and the road, before anything is built.
 */
export function SiteMapView() {
  const project = useActiveProject()
  const openBriefEditor = useProjectsStore((state) => state.openBriefEditor)
  const plot = useDesignStore((state) => state.plot)
  const floors = useDesignStore((state) => state.floors)
  const site = project?.site ?? null
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const [config, setConfig] = useState<MapConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [basemap, setBasemap] = useState<Basemap>('satellite')
  const models = useMemo(() => buildBuildingModel(floors, plot), [floors, plot])
  const placed = site?.origin ? (site as Placed) : null

  useEffect(() => {
    if (!site) return
    let cancelled = false
    getMapConfig()
      .then((c) => !cancelled && setConfig(c))
      .catch((err) => !cancelled && setError(err instanceof ApiError ? err.message : 'The map could not load.'))
    return () => {
      cancelled = true
    }
  }, [site])

  useEffect(() => {
    if (!config || !site || !containerRef.current) return
    const map = new MapLibre({ container: containerRef.current, style: style(config), center: [site.lng, site.lat], zoom: config.satellite.maxZoom, maxZoom: config.satellite.maxZoom + 3 })
    map.addControl(new NavigationControl({ showCompass: true }), 'top-right')
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    if (!site.origin) new Marker({ color: '#e53935' }).setLngLat([site.lng, site.lat]).addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [config, site])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !site) return
    const draw = () => {
      if (site.boundary) {
        const ring = site.boundary.map((c) => [c.lng, c.lat] as [number, number])
        ;(map.getSource('boundary') as GeoJSONSource).setData({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] } })
        const bounds = ring.reduce((b, c) => b.extend(c), new LngLatBounds(ring[0], ring[0]))
        map.fitBounds(bounds, { padding: 80, maxZoom: (config?.satellite.maxZoom ?? 19) + 2, duration: 0 })
      }
      if (placed) (map.getSource('plan') as GeoJSONSource).setData(footprintFeatures(placed, models))
    }
    if (map.isStyleLoaded()) draw()
    else map.once('load', draw)
  }, [site, placed, models, config])

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

  if (!project) return null
  if (!site) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={MapPinned}
          title="Put the plan on the map"
          description="Find the plot on a satellite map and mark its corners. You'll see the house to scale on the real site, with the road and neighbours."
          action={<Button onClick={() => openBriefEditor(project.id)}>Add the location</Button>}
          className="max-w-lg border-none"
        />
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {error ? (
        <p className="flex h-full items-center justify-center text-sm text-text-muted">{error}</p>
      ) : (
        <div ref={containerRef} className="h-full w-full" data-testid="site-view-map" />
      )}
      <div className="absolute top-3 left-3 flex flex-col gap-2">
        <div className="rounded-md bg-surface/90 shadow-sm">
          <SegmentedControl<Basemap>
            value={basemap}
            onChange={setBasemap}
            options={[
              { value: 'satellite', label: 'Satellite' },
              { value: 'streets', label: 'Map' },
            ]}
          />
        </div>
        <div className="max-w-xs rounded-md bg-surface/95 px-3 py-2 text-xs text-text-muted shadow-sm">
          <p className="font-medium text-text">{site.formattedAddress || `${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`}</p>
          {placed ? (
            <p className="mt-1">Ground floor to scale; upper floors dashed in red. Yellow dashes: the boundary marked on the map.</p>
          ) : (
            <p className="mt-1">
              Mark the plot's corners in the brief to place the plan here.{' '}
              <button type="button" className="font-medium text-primary" onClick={() => openBriefEditor(project.id)}>
                Edit location
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
