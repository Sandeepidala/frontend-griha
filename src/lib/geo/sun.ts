/**
 * Where the sun is, and the shadows it casts, for the 3D site view's sun study. NOAA's simplified
 * solar-position formulas: accurate to well under a degree, plenty for massing and shading studies.
 */

const RAD = Math.PI / 180

export interface SunPosition {
  /** Degrees clockwise from north. */
  azimuth: number
  /** Degrees above the horizon; negative at night. */
  altitude: number
}

/** The day of the year (1–366) for a month (1–12) and day. */
export function dayOfYear(month: number, day: number) {
  const cumulative = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  return cumulative[month - 1] + day
}

/**
 * The sun's position at a site on a day of the year, at a clock time in the site's time zone
 * (`utcOffsetHours`, e.g. 5.5 for India).
 */
export function sunPosition(lat: number, lng: number, doy: number, clockHours: number, utcOffsetHours: number): SunPosition {
  const gamma = ((2 * Math.PI) / 365) * (doy - 1 + (clockHours - 12) / 24)
  const eqTime =
    229.18 *
    (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma))
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma)
  // True solar time, minutes.
  const solar = clockHours * 60 + eqTime + 4 * lng - 60 * utcOffsetHours
  const hourAngle = (solar / 4 - 180) * RAD
  const phi = lat * RAD
  const cosZenith = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(hourAngle)
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZenith)))
  const azimuth = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) / RAD + 180
  return { azimuth: (azimuth + 360) % 360, altitude: 90 - zenith / RAD }
}

/** The UTC offset to assume for a country: India's is fixed; elsewhere, the longitude's nominal zone. */
export function utcOffsetFor(countryCode: string | null | undefined, lng: number) {
  if (countryCode === 'IN') return 5.5
  return Math.round(lng / 15) || 0
}

type Pt = [number, number]

function hull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Pt[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Pt[] = []
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/**
 * The ground shadow of a prism (a footprint `ring` in metres east/north, `height` metres tall): the
 * outline swept away from the sun by height ÷ tan(altitude). Null when the sun is down or too low to
 * cast a meaningful shadow.
 */
export function shadowOf(ring: Pt[], height: number, sun: SunPosition): Pt[] | null {
  if (sun.altitude <= 3 || height <= 0) return null
  const length = height / Math.tan(sun.altitude * RAD)
  // Shadows point away from the sun.
  const away = (sun.azimuth + 180) * RAD
  const dx = Math.sin(away) * length
  const dy = Math.cos(away) * length
  return hull([...ring, ...ring.map(([x, y]) => [x + dx, y + dy] as Pt)])
}
