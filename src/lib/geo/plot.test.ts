import { describe, expect, it } from 'vitest'
import { fromLocal, planRectToRing, planToLatLng, plotFromBoundary, toLocal, type LatLng } from './plot'

const FT = 0.3048
const centre: LatLng = { lat: 12.93, lng: 77.58 }

/** A W×H ft rectangle centred on `centre`, turned `deg` clockwise; corners NW, NE, SE, SW (before turning). */
function rectangle(widthFt: number, heightFt: number, deg = 0): LatLng[] {
  const w = (widthFt * FT) / 2
  const h = (heightFt * FT) / 2
  const t = (deg * Math.PI) / 180
  return [
    [-w, h],
    [w, h],
    [w, -h],
    [-w, -h],
  ].map(([e, n]) => fromLocal(centre, e * Math.cos(t) + n * Math.sin(t), -e * Math.sin(t) + n * Math.cos(t)))
}

function distanceM(a: LatLng, b: LatLng) {
  const d = toLocal(a, b)
  return Math.hypot(d.east, d.north)
}

describe('plotFromBoundary', () => {
  it('reads a north-facing plot square to the compass', () => {
    const corners = rectangle(30, 40)
    const plot = plotFromBoundary(corners, 0)
    expect(plot).toMatchObject({ width: 30, height: 40, facing: 'north', rotationDeg: 0, frontageFt: 30, depthFt: 40, areaSqft: 1200, shape: 'rectangular' })
    expect(distanceM(plot.origin, corners[0])).toBeLessThan(0.01)
  })

  it('takes facing from the road side and keeps frontage along the road', () => {
    const plot = plotFromBoundary(rectangle(30, 40), 1) // the east side is on the road
    expect(plot).toMatchObject({ facing: 'east', width: 30, height: 40, frontageFt: 40, depthFt: 30 })
  })

  it('keeps a turned plot’s size and records the turn', () => {
    const corners = rectangle(30, 40, 20)
    const plot = plotFromBoundary(corners, 0)
    expect(plot).toMatchObject({ width: 30, height: 40, facing: 'north', rotationDeg: 20 })
    // Rounds to the nearest compass point: 50° from north is east-facing, turned −40°.
    expect(plotFromBoundary(rectangle(30, 40, 50), 0)).toMatchObject({ facing: 'east', rotationDeg: -40 })
  })

  it('lays the plan back onto the map at the right corners', () => {
    for (const deg of [0, 20, -35]) {
      const corners = rectangle(30, 40, deg)
      const plot = plotFromBoundary(corners, 0)
      const site = { origin: plot.origin, rotationDeg: plot.rotationDeg }
      const planCorners = [planToLatLng(site, 0, 0), planToLatLng(site, 30, 0), planToLatLng(site, 30, 40), planToLatLng(site, 0, 40)]
      planCorners.forEach((p, i) => expect(distanceM(p, corners[i])).toBeLessThan(0.02))
    }
  })

  it('spots a trapezoid and lists every side', () => {
    const [nw, ne, se, sw] = rectangle(30, 40)
    const narrowRear = [nw, ne, fromLocal(se, -6 * FT, 0), sw]
    const plot = plotFromBoundary(narrowRear, 0)
    expect(plot.shape).toBe('trapezoidal')
    expect(plot.sidesFt[0]).toBeCloseTo(30, 0)
    expect(plot.sidesFt[2]).toBeCloseTo(24, 0)
  })
})

describe('planRectToRing', () => {
  it('returns a closed [lng, lat] ring', () => {
    const plot = plotFromBoundary(rectangle(30, 40), 0)
    const ring = planRectToRing({ origin: plot.origin, rotationDeg: 0 }, { x: 5, y: 5, width: 20, height: 30 })
    expect(ring).toHaveLength(5)
    expect(ring[0]).toEqual(ring[4])
    expect(ring[0][0]).toBeGreaterThan(plot.origin.lng)
    expect(ring[0][1]).toBeLessThan(plot.origin.lat)
  })
})
