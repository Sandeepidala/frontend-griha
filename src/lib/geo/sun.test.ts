import { describe, expect, it } from 'vitest'
import { dayOfYear, shadowOf, sunPosition, utcOffsetFor } from './sun'

// Bengaluru.
const LAT = 12.97
const LNG = 77.59

describe('sunPosition', () => {
  it('puts the sun high and to the south at a Bengaluru midwinter noon', () => {
    // Solar noon in Bengaluru is about 12:20 IST; on 21 Dec the sun is ~53.6° up, due south.
    const noon = sunPosition(LAT, LNG, dayOfYear(12, 21), 12 + 20 / 60, 5.5)
    expect(noon.altitude).toBeCloseTo(90 - LAT - 23.44, 0)
    expect(noon.azimuth).toBeGreaterThan(175)
    expect(noon.azimuth).toBeLessThan(185)
  })

  it('swings north of overhead in June, rises in the east and sets in the west', () => {
    const juneNoon = sunPosition(LAT, LNG, dayOfYear(6, 21), 12 + 20 / 60, 5.5)
    expect(juneNoon.altitude).toBeGreaterThan(75)
    expect(juneNoon.azimuth < 30 || juneNoon.azimuth > 330).toBe(true)
    const morning = sunPosition(LAT, LNG, dayOfYear(3, 21), 8, 5.5)
    const evening = sunPosition(LAT, LNG, dayOfYear(3, 21), 17, 5.5)
    expect(morning.azimuth).toBeGreaterThan(80)
    expect(morning.azimuth).toBeLessThan(100)
    expect(evening.azimuth).toBeGreaterThan(255)
    expect(evening.azimuth).toBeLessThan(280)
    expect(sunPosition(LAT, LNG, dayOfYear(3, 21), 23, 5.5).altitude).toBeLessThan(0)
  })

  it('uses IST in India and the longitude zone elsewhere', () => {
    expect(utcOffsetFor('IN', 77.6)).toBe(5.5)
    expect(utcOffsetFor('GB', -0.1)).toBe(0)
    expect(utcOffsetFor(null, 139.7)).toBe(9)
  })
})

describe('shadowOf', () => {
  const square: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]

  it('casts a shadow away from the sun, longer when the sun is lower', () => {
    // Sun due east at 45°: a 10 m block throws a 10 m shadow to the west.
    const shadow = shadowOf(square, 10, { azimuth: 90, altitude: 45 })!
    const xs = shadow.map((p) => p[0])
    expect(Math.min(...xs)).toBeCloseTo(-10, 5)
    expect(Math.max(...xs)).toBeCloseTo(10, 5)
    const low = shadowOf(square, 10, { azimuth: 90, altitude: 20 })!
    expect(Math.min(...low.map((p) => p[0]))).toBeLessThan(-25)
  })

  it('casts nothing when the sun is down', () => {
    expect(shadowOf(square, 10, { azimuth: 270, altitude: -5 })).toBeNull()
  })
})
