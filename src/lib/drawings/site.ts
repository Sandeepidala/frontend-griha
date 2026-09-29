import type { DrawingSet } from './sheets'
import { type Rect, EXTERIOR_WALL, frontSide, unionRect } from './geometry'

/** Site-level layout shared by the site plan sheets and the 3D landscape model. */

export const ROAD_WIDTH = 24
const GATE_WIDTH = 10
export const COMPOUND = 0.5

export function siteContext(set: DrawingSet) {
  const { plot } = set
  const ground = set.models[0]
  const front = frontSide(plot)
  const plotRect: Rect = { x: 0, y: 0, width: plot.width, height: plot.height }
  const road: Rect = {
    N: { x: -8, y: -ROAD_WIDTH, width: plot.width + 16, height: ROAD_WIDTH },
    S: { x: -8, y: plot.height, width: plot.width + 16, height: ROAD_WIDTH },
    E: { x: plot.width, y: -8, width: ROAD_WIDTH, height: plot.height + 16 },
    W: { x: -ROAD_WIDTH, y: -8, width: ROAD_WIDTH, height: plot.height + 16 },
  }[front]
  const horizontalFront = front === 'N' || front === 'S'
  const frontLength = horizontalFront ? plot.width : plot.height
  const parking = ground?.rooms.find((r) => /park|garage|car/i.test(r.name))
  const anchor = parking ? (horizontalFront ? parking.x + parking.width / 2 : parking.y + parking.height / 2) : frontLength / 2
  const gateWidth = Math.min(GATE_WIDTH, frontLength - 2)
  const gateStart = Math.min(Math.max(0.5, anchor - gateWidth / 2), frontLength - gateWidth - 0.5)
  const footprint = ground?.footprint ?? null
  const bounds = unionRect([plotRect, road])!
  return { plot, ground, front, plotRect, road, horizontalFront, gateStart, gateWidth, footprint, bounds }
}

export type Site = ReturnType<typeof siteContext>

export function gateRect(site: Site): Rect {
  const { front, plot, gateStart, gateWidth } = site
  switch (front) {
    case 'N':
      return { x: gateStart, y: 0, width: gateWidth, height: COMPOUND }
    case 'S':
      return { x: gateStart, y: plot.height - COMPOUND, width: gateWidth, height: COMPOUND }
    case 'W':
      return { x: 0, y: gateStart, width: COMPOUND, height: gateWidth }
    case 'E':
      return { x: plot.width - COMPOUND, y: gateStart, width: COMPOUND, height: gateWidth }
  }
}

/** Paved drive from the gate to the building face (only when there's a front open space). */
export function driveway(site: Site): Rect | null {
  const { footprint, front, plot } = site
  if (!footprint) return null
  const gate = gateRect(site)
  switch (front) {
    case 'N':
      return footprint.y > 1 ? { x: gate.x, y: COMPOUND, width: gate.width, height: footprint.y - COMPOUND } : null
    case 'S': {
      const bottom = footprint.y + footprint.height
      return plot.height - bottom > 1 ? { x: gate.x, y: bottom, width: gate.width, height: plot.height - COMPOUND - bottom } : null
    }
    case 'W':
      return footprint.x > 1 ? { x: COMPOUND, y: gate.y, width: footprint.x - COMPOUND, height: gate.height } : null
    case 'E': {
      const right = footprint.x + footprint.width
      return plot.width - right > 1 ? { x: right, y: gate.y, width: plot.width - COMPOUND - right, height: gate.height } : null
    }
  }
}

export interface LandscapeLayout {
  strips: { rect: Rect; horizontal: boolean }[]
  trees: { x: number; y: number; r: number }[]
  shrubs: { x: number; y: number; r: number }[]
  avenue: { x: number; y: number }[]
  planters: Rect[]
  drive: Rect | null
  lawnArea: number
  planterLength: number
}

export function landscapeLayout(set: DrawingSet): LandscapeLayout {
  const site = siteContext(set)
  const { plot } = set
  const fp = site.footprint
  const drive = driveway(site)
  const top = set.models[set.models.length - 1]

  // Open strips between the compound wall and the building.
  const strips: { rect: Rect; horizontal: boolean }[] = []
  if (fp) {
    const inset = COMPOUND
    const n = fp.y - inset
    const s = plot.height - inset - (fp.y + fp.height)
    const w = fp.x - inset
    const e = plot.width - inset - (fp.x + fp.width)
    if (n > 0.5) strips.push({ rect: { x: inset, y: inset, width: plot.width - inset * 2, height: n }, horizontal: true })
    if (s > 0.5) strips.push({ rect: { x: inset, y: fp.y + fp.height, width: plot.width - inset * 2, height: s }, horizontal: true })
    if (w > 0.5) strips.push({ rect: { x: inset, y: Math.max(inset, fp.y), width: w, height: fp.height }, horizontal: false })
    if (e > 0.5) strips.push({ rect: { x: fp.x + fp.width, y: Math.max(inset, fp.y), width: e, height: fp.height }, horizontal: false })
  }

  const trees: { x: number; y: number; r: number }[] = []
  const shrubs: { x: number; y: number; r: number }[] = []
  for (const { rect, horizontal } of strips) {
    const depth = horizontal ? rect.height : rect.width
    const length = horizontal ? rect.width : rect.height
    if (depth >= 4) {
      const r = Math.min(depth / 2 - 0.3, 5)
      const count = Math.max(1, Math.floor(length / 12))
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count
        const p = horizontal ? { x: rect.x + rect.width * t, y: rect.y + rect.height / 2 } : { x: rect.x + rect.width / 2, y: rect.y + rect.height * t }
        if (drive && p.x > drive.x - r && p.x < drive.x + drive.width + r && p.y > drive.y - r && p.y < drive.y + drive.height + r) continue
        trees.push({ ...p, r })
      }
    } else if (depth >= 1) {
      const count = Math.floor(length / 2)
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count
        const p = horizontal ? { x: rect.x + rect.width * t, y: rect.y + rect.height / 2 } : { x: rect.x + rect.width / 2, y: rect.y + rect.height * t }
        if (drive && p.x > drive.x && p.x < drive.x + drive.width && p.y > drive.y && p.y < drive.y + drive.height) continue
        shrubs.push({ ...p, r: Math.min(depth / 2 - 0.1, 0.8) })
      }
    }
  }

  // Avenue trees on the road verge.
  const avenue: { x: number; y: number }[] = []
  const frontLen = site.horizontalFront ? plot.width : plot.height
  const verge = 3
  for (let a = 7; a < frontLen - 3; a += 15) {
    avenue.push(
      {
        N: { x: a, y: -verge },
        S: { x: a, y: plot.height + verge },
        W: { x: -verge, y: a },
        E: { x: plot.width + verge, y: a },
      }[site.front],
    )
  }

  // Terrace garden planters along the parapet of the top roof.
  const planters: Rect[] = []
  if (top?.footprint) {
    const r = top.footprint
    const d = 1.25
    const inset = EXTERIOR_WALL
    planters.push({ x: r.x + inset, y: r.y + inset, width: r.width - inset * 2, height: d })
    planters.push({ x: r.x + inset, y: r.y + r.height - inset - d, width: r.width - inset * 2, height: d })
  }

  const lawnArea = strips.reduce((sum, s) => sum + s.rect.width * s.rect.height, 0) - (drive ? drive.width * drive.height : 0)
  const planterLength = planters.reduce((s, p) => s + Math.max(p.width, p.height), 0)
  return { strips, trees, shrubs, avenue, planters, drive, lawnArea, planterLength }
}
