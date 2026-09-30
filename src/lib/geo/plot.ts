import type { Plot } from '@/types/design'

/**
 * Between the map (latitude/longitude) and the plan (feet, north-up, x east, y south, origin at the
 * plot's north-west corner). Plots are a few dozen metres across, so a flat local projection around
 * the plot is accurate to millimetres.
 */

export interface LatLng {
  lat: number
  lng: number
}

const EARTH_RADIUS_M = 6_371_008.8
const M_PER_FT = 0.3048
const RAD = Math.PI / 180

/** Metres east and north of `origin`. */
export function toLocal(origin: LatLng, point: LatLng) {
  return {
    east: (point.lng - origin.lng) * RAD * EARTH_RADIUS_M * Math.cos(origin.lat * RAD),
    north: (point.lat - origin.lat) * RAD * EARTH_RADIUS_M,
  }
}

export function fromLocal(origin: LatLng, east: number, north: number): LatLng {
  return {
    lat: origin.lat + north / EARTH_RADIUS_M / RAD,
    lng: origin.lng + east / (EARTH_RADIUS_M * Math.cos(origin.lat * RAD)) / RAD,
  }
}

const FACING_BEARING: Record<Plot['facing'], number> = { north: 0, east: 90, south: 180, west: 270 }

/** -180…180 */
function wrap(deg: number) {
  return ((((deg + 180) % 360) + 360) % 360) - 180
}

export interface PlotFromBoundary {
  /** Plan width (x, west–east) and height (y, north–south) in feet, as the editor records plots. */
  width: number
  height: number
  facing: Plot['facing']
  /** How far the plot is turned clockwise from `facing`, degrees; the plan is drawn north-up. */
  rotationDeg: number
  /** Where the plan's origin (its north-west corner) is on the ground. */
  origin: LatLng
  frontageFt: number
  depthFt: number
  areaSqft: number
  /** Opposite sides differing by more than 5% make the plot a trapezoid, not a rectangle. */
  shape: 'rectangular' | 'trapezoidal' | 'irregular'
  /** Every side in feet, in corner order, for the brief's shape notes. */
  sidesFt: number[]
}

function polygonArea(points: { x: number; y: number }[]) {
  let sum = 0
  points.forEach((p, i) => {
    const q = points[(i + 1) % points.length]
    sum += p.x * q.y - q.x * p.y
  })
  return Math.abs(sum) / 2
}

/**
 * Reads plot dimensions off the corners clicked on the map. `roadEdge` is the side on the road
 * (corner `roadEdge` to the next). Facing is that side's outward direction, rounded to the nearest
 * compass point; the remainder is kept as `rotationDeg` so the plan can be laid back onto the map.
 */
export function plotFromBoundary(corners: LatLng[], roadEdge: number): PlotFromBoundary {
  if (corners.length < 3) throw new Error('A plot needs at least three corners.')
  const centre = {
    lat: corners.reduce((s, c) => s + c.lat, 0) / corners.length,
    lng: corners.reduce((s, c) => s + c.lng, 0) / corners.length,
  }
  // Metres, x east and y north.
  const pts = corners.map((c) => {
    const l = toLocal(centre, c)
    return { x: l.east, y: l.north }
  })
  const a = pts[roadEdge % pts.length]
  const b = pts[(roadEdge + 1) % pts.length]
  // The road edge's outward normal points away from the plot's centre (the origin here).
  const edge = { x: b.x - a.x, y: b.y - a.y }
  let normal = { x: edge.y, y: -edge.x }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  if (normal.x * mid.x + normal.y * mid.y < 0) normal = { x: -normal.x, y: -normal.y }
  const bearing = (Math.atan2(normal.x, normal.y) / RAD + 360) % 360
  const facing = (['north', 'east', 'south', 'west'] as const)[Math.round(bearing / 90) % 4]
  const rotationDeg = wrap(bearing - FACING_BEARING[facing])

  // Turn the plot back by its rotation so its sides line up with the compass, then take the extents.
  const t = rotationDeg * RAD
  const aligned = pts.map((p) => ({ x: p.x * Math.cos(t) - p.y * Math.sin(t), y: p.x * Math.sin(t) + p.y * Math.cos(t) }))
  const minX = Math.min(...aligned.map((p) => p.x))
  const maxX = Math.max(...aligned.map((p) => p.x))
  const minY = Math.min(...aligned.map((p) => p.y))
  const maxY = Math.max(...aligned.map((p) => p.y))
  const width = (maxX - minX) / M_PER_FT
  const height = (maxY - minY) / M_PER_FT
  // The plan's north-west corner, turned back to the ground.
  const nw = { x: minX, y: maxY }
  const origin = fromLocal(centre, nw.x * Math.cos(t) + nw.y * Math.sin(t), -nw.x * Math.sin(t) + nw.y * Math.cos(t))

  const sidesFt = pts.map((p, i) => {
    const q = pts[(i + 1) % pts.length]
    return Math.hypot(q.x - p.x, q.y - p.y) / M_PER_FT
  })
  let shape: PlotFromBoundary['shape'] = 'irregular'
  if (pts.length === 4) {
    const close = (m: number, n: number) => Math.abs(m - n) <= 0.05 * Math.max(m, n)
    shape = close(sidesFt[0], sidesFt[2]) && close(sidesFt[1], sidesFt[3]) ? 'rectangular' : 'trapezoidal'
  }
  const alongX = facing === 'north' || facing === 'south'
  return {
    width: round1(width),
    height: round1(height),
    facing,
    rotationDeg: Math.round(rotationDeg * 10) / 10,
    origin,
    frontageFt: round1(alongX ? width : height),
    depthFt: round1(alongX ? height : width),
    areaSqft: Math.round(polygonArea(pts) / (M_PER_FT * M_PER_FT)),
    shape,
    sidesFt: sidesFt.map(round1),
  }
}

function round1(v: number) {
  return Math.round(v * 10) / 10
}

/** A point on the plan (feet, x east, y south from the north-west corner) placed on the map. */
export function planToLatLng(site: { origin: LatLng; rotationDeg: number }, x: number, y: number): LatLng {
  const t = site.rotationDeg * RAD
  const east = x * M_PER_FT
  const north = -y * M_PER_FT
  // The plan is the ground turned back by the rotation; turn it forward again.
  return fromLocal(site.origin, east * Math.cos(t) + north * Math.sin(t), -east * Math.sin(t) + north * Math.cos(t))
}

/** A plan rectangle as a closed ring of [lng, lat] pairs, the order map libraries use. */
export function planRectToRing(site: { origin: LatLng; rotationDeg: number }, r: { x: number; y: number; width: number; height: number }) {
  const corners = [
    [r.x, r.y],
    [r.x + r.width, r.y],
    [r.x + r.width, r.y + r.height],
    [r.x, r.y + r.height],
    [r.x, r.y],
  ]
  return corners.map(([x, y]) => {
    const p = planToLatLng(site, x, y)
    return [p.lng, p.lat] as [number, number]
  })
}
