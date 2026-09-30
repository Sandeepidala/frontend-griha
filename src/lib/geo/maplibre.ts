/**
 * MapLibre, ready to use. Its web worker is looked up next to the library at runtime, which a
 * bundler can't see; so Vite bundles the worker here and MapLibre is told where it is. Import
 * MapLibre from this module, never from 'maplibre-gl' directly.
 */
import 'maplibre-gl/dist/maplibre-gl.css'
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

setWorkerUrl(workerUrl)

export { GeoJSONSource, LngLatBounds, Map, Marker, NavigationControl, ScaleControl } from 'maplibre-gl'
export type { MapMouseEvent, StyleSpecification } from 'maplibre-gl'
