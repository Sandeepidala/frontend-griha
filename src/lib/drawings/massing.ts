import { type FloorModel, type PlanOpening, type Rect, type WallSegment, PARAPET_HEIGHT, PLINTH_HEIGHT, SLAB_THICKNESS, isDoor, wallRect } from './geometry'

/**
 * The building as boxes (walls cut around doors and windows, glass, slabs, parapets, plinth), in plan
 * feet with heights in feet. Drawn by the 3D model sheets and extruded on the map in the 3D site view.
 */

export const MASSING_COLORS = {
  wall: '#f1ece4',
  wallInterior: '#f7f5f0',
  slab: '#d8d2c8',
  plinth: '#b9b0a3',
  glass: '#8fb7d9',
  door: '#8a5a3b',
  parapetCap: '#cfc7bb',
}

/** What a piece of the building is, so the build sequence, the estimate and the drawings can tell parts apart. */
export type SolidRole =
  | 'plinth'
  | 'wall'
  | 'wall-interior'
  | 'glass'
  | 'door'
  | 'sill'
  | 'slab'
  | 'band'
  | 'parapet'
  | 'coping'
  | 'railing'
  | 'roof'
  | 'fascia'
  | 'shade'
  | 'porch'
  | 'pillar'
  | 'cladding'
  | 'jharokha'
  | 'pergola'
  | 'dome'

/**
 * A box fills its rect. A slope runs from its rect at z0 up to the rect inset by `inset` at z1: a hip
 * roof (inset to a ridge line), a gable, a lean-to sunshade (inset fully on its outer side), a pyramid.
 * A cylinder and a dome stand inside the rect.
 */
export type Shape =
  | { kind: 'box' }
  | { kind: 'slope'; inset: { n: number; s: number; e: number; w: number } }
  | { kind: 'cylinder' }
  | { kind: 'dome' }

export interface Box {
  rect: Rect
  z0: number
  z1: number
  color: string
  opacity?: number
  role?: SolidRole
  /** A box when absent. */
  shape?: Shape
}

/** Splits a wall into solid pieces around its openings, plus glass/door panels in the holes. */
export function wallBoxes(
  wall: WallSegment,
  openings: PlanOpening[],
  height: number,
  color: string,
  role: SolidRole = wall.exterior ? 'wall' : 'wall-interior',
  panels: { glass?: string; door?: string } = {},
): Box[] {
  const r = wallRect(wall)
  const horizontal = wall.orientation === 'h'
  const start = horizontal ? r.x : r.y
  const end = start + (horizontal ? r.width : r.height)
  const piece = (a: number, b: number): Rect => (horizontal ? { x: a, y: r.y, width: b - a, height: r.height } : { x: r.x, y: a, width: r.width, height: b - a })
  const thin = (a: number, b: number): Rect => {
    const t = 0.12
    return horizontal
      ? { x: a, y: r.y + r.height / 2 - t / 2, width: b - a, height: t }
      : { x: r.x + r.width / 2 - t / 2, y: a, width: t, height: b - a }
  }
  const out: Box[] = []
  let cursor = start
  const own = openings.filter((o) => o.wall.id === wall.id).sort((a, b) => a.center - b.center)
  for (const o of own) {
    const a0 = Math.max(cursor, o.center - o.width / 2)
    const a1 = o.center + o.width / 2
    if (a0 > cursor + 0.01) out.push({ rect: piece(cursor, a0), z0: 0, z1: height, color, role })
    const top = Math.min(height, o.sill + o.height)
    if (o.sill > 0) out.push({ rect: piece(a0, a1), z0: 0, z1: o.sill, color, role })
    if (top < height) out.push({ rect: piece(a0, a1), z0: top, z1: height, color, role })
    if (!isDoor(o)) out.push({ rect: thin(a0, a1), z0: o.sill, z1: top, color: panels.glass ?? MASSING_COLORS.glass, opacity: 0.55, role: 'glass' })
    else if (o.kind === 'main-door') out.push({ rect: thin(a0, a1), z0: 0, z1: top, color: panels.door ?? MASSING_COLORS.door, role: 'door' })
    cursor = a1
  }
  if (end > cursor + 0.01) out.push({ rect: piece(cursor, end), z0: 0, z1: height, color, role })
  return out
}

/** The storey's wall height: floor to the underside of the slab above. */
export function wallHeightOf(model: FloorModel) {
  return model.height - SLAB_THICKNESS
}

/** One floor's walls, cut around their doors and windows (with the glass and main door in the holes). */
export function floorWallBoxes(model: FloorModel): Box[] {
  const height = wallHeightOf(model)
  return model.walls.flatMap((w) => wallBoxes(w, model.openings, height, w.exterior ? MASSING_COLORS.wall : MASSING_COLORS.wallInterior))
}

/** One floor's slab and the chajja band at its edge; below the top floor, a sliver joining the walls above. */
export function floorSlabBoxes(model: FloorModel, isTop: boolean): Box[] {
  if (!model.footprint) return []
  const fp = model.footprint
  const boxes: Box[] = [
    { rect: fp, z0: model.height - SLAB_THICKNESS, z1: model.height, color: MASSING_COLORS.slab },
    // Slab edge band reads as a drip/chajja line on the facade.
    { rect: { x: fp.x - 0.3, y: fp.y - 0.3, width: fp.width + 0.6, height: fp.height + 0.6 }, z0: model.height - SLAB_THICKNESS, z1: model.height - SLAB_THICKNESS + 0.3, color: MASSING_COLORS.slab },
  ]
  if (!isTop) for (const w of model.walls.filter((x) => x.exterior)) boxes.push({ rect: wallRect(w), z0: model.height, z1: model.height + 0.01, color: MASSING_COLORS.wall })
  return boxes
}

/** The top floor's parapet on its outer walls, with the coping on top. */
export function parapetBoxes(model: FloorModel): Box[] {
  if (!model.footprint) return []
  return model.walls
    .filter((x) => x.exterior)
    .flatMap((w) => {
      const r = wallRect(w)
      return [
        { rect: r, z0: model.height, z1: model.height + PARAPET_HEIGHT, color: MASSING_COLORS.wall },
        { rect: { x: r.x - 0.1, y: r.y - 0.1, width: r.width + 0.2, height: r.height + 0.2 }, z0: model.height + PARAPET_HEIGHT, z1: model.height + PARAPET_HEIGHT + 0.25, color: MASSING_COLORS.parapetCap },
      ]
    })
}

/** One floor's walls, and (seen from outside) its slab, chajja band and parapet. */
export function floorShellBoxes(model: FloorModel, isTop: boolean, interior: boolean): Box[] {
  const walls = floorWallBoxes(model)
  if (interior) return walls
  return [...walls, ...floorSlabBoxes(model, isTop), ...(isTop ? parapetBoxes(model) : [])]
}

/**
 * The whole building from outside, with heights from the ground: the plinth, then every floor's shell
 * lifted by its elevation (plus the plinth).
 */
export function buildingBoxes(models: FloorModel[]): Box[] {
  const ground = models[0]
  const out: Box[] = []
  if (ground?.footprint) out.push({ rect: ground.footprint, z0: 0, z1: PLINTH_HEIGHT, color: MASSING_COLORS.plinth })
  models.forEach((model, i) => {
    const lift = model.floor.elevation + PLINTH_HEIGHT
    for (const box of floorShellBoxes(model, i === models.length - 1, false)) out.push({ ...box, z0: box.z0 + lift, z1: box.z1 + lift })
  })
  return out
}

