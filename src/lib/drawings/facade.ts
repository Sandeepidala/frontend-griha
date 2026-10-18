import type { RateKey } from '@/lib/boq/rates'
import type { Look } from '@/lib/style/kits'
import type { Plot } from '@/types/design'
import { type FloorModel, type PlanOpening, type Rect, type Side, type WallSegment, PARAPET_HEIGHT, PLINTH_HEIGHT, SLAB_THICKNESS, frontSide, isDoor, wallRect } from './geometry'
import { type Box, MASSING_COLORS, wallBoxes, wallHeightOf } from './massing'

/**
 * The house as its style builds it: the plan's walls, slabs and openings, finished in the style's
 * colours, with its roof or parapet, verandah, sunshades and details. Plan feet, heights from the
 * ground (the plinth sits on z = 0). The 3D model, the 3D site view, the elevations and the build
 * video draw these pieces; the estimate prices the style's items from the same pass (`takeoff`).
 * Sills, RCC sunshades and floor bands are part of every house, so they're not in the takeoff.
 */

/** When the piece goes up, for the build sequence: with the plinth, a floor's walls or frame, the roof, or the details. */
export type FacadeStage = 'plinth' | 'walls' | 'frame' | 'top' | 'details'

export interface FacadeSolid extends Box {
  stage: FacadeStage
  /** The floor it belongs to (walls, slab and bands). */
  floorId?: string
}

export interface TakeoffItem {
  key: RateKey
  quantity: number
}

export interface Facade {
  solids: FacadeSolid[]
  /** The style's own items, measured for the estimate. */
  takeoff: TakeoffItem[]
  /** Highest point, ft from the ground. */
  top: number
}

const GLASS = '#9dbfd9'
const RAILING_GLASS = '#b9d6e6'
const SLAB = MASSING_COLORS.slab

/** A rect outside a wall's outer face, over [a, b] along the wall, `offset` out from the face and `depth` deep. */
function faceStrip(wall: WallSegment, a: number, b: number, depth: number, offset = 0): Rect {
  const r = wallRect(wall)
  switch (wall.outside) {
    case 'N':
      return { x: a, y: r.y - offset - depth, width: b - a, height: depth }
    case 'S':
      return { x: a, y: r.y + r.height + offset, width: b - a, height: depth }
    case 'W':
      return { x: r.x - offset - depth, y: a, width: depth, height: b - a }
    case 'E':
    default:
      return { x: r.x + r.width + offset, y: a, width: depth, height: b - a }
  }
}

/** The wall's extent along its length, outer corners included. */
function wallSpan(wall: WallSegment): [number, number] {
  const r = wallRect(wall)
  return wall.orientation === 'h' ? [r.x, r.x + r.width] : [r.y, r.y + r.height]
}

/** Free ground between a wall's outer face and the plot boundary. */
function roomOutside(plot: Plot, wall: WallSegment) {
  const r = wallRect(wall)
  switch (wall.outside) {
    case 'N':
      return r.y
    case 'S':
      return plot.height - (r.y + r.height)
    case 'W':
      return r.x
    case 'E':
    default:
      return plot.width - (r.x + r.width)
  }
}

/** A lean-to: slopes down and out from the wall face over the strip, with hipped ends. */
function leanToInset(side: Side, depth: number, ends: number) {
  const inset = { n: 0, s: 0, e: 0, w: 0 }
  if (side === 'N' || side === 'S') {
    inset[side === 'N' ? 'n' : 's'] = depth
    inset.e = inset.w = ends
  } else {
    inset[side === 'E' ? 'e' : 'w'] = depth
    inset.n = inset.s = ends
  }
  return inset
}

/** A hip roof over a rect: equal slopes on all four sides up to a ridge along its longer side. */
export function hipInset(rect: Rect) {
  const half = Math.min(rect.width, rect.height) / 2
  return { n: half, s: half, e: half, w: half }
}

function expand(rect: Rect, by: number): Rect {
  return { x: rect.x - by, y: rect.y - by, width: rect.width + by * 2, height: rect.height + by * 2 }
}

/** Pieces of a band [a, b] × [z0, z1] on a wall's face that leave its openings clear (heights from the floor). */
function aroundOpenings(wall: WallSegment, openings: PlanOpening[], a: number, b: number, z0: number, z1: number) {
  const holes = openings
    .filter((o) => o.wall.id === wall.id)
    .map((o) => ({ a: o.center - o.width / 2, b: o.center + o.width / 2, z0: o.sill, z1: o.sill + o.height }))
    .filter((o) => o.b > a && o.a < b && o.z1 > z0 && o.z0 < z1)
    .sort((p, q) => p.a - q.a)
  const out: { a: number; b: number; z0: number; z1: number }[] = []
  let cursor = a
  for (const o of holes) {
    const oa = Math.max(o.a, cursor)
    const ob = Math.min(o.b, b)
    if (oa > cursor + 0.01) out.push({ a: cursor, b: oa, z0, z1 })
    if (ob > oa) {
      if (o.z0 > z0 + 0.01) out.push({ a: oa, b: ob, z0, z1: Math.min(z1, o.z0) })
      if (o.z1 < z1 - 0.01) out.push({ a: oa, b: ob, z0: Math.max(z0, o.z1), z1 })
    }
    cursor = Math.max(cursor, ob)
  }
  if (b > cursor + 0.01) out.push({ a: cursor, b, z0, z1 })
  return out
}

/** The exterior wall colour for a floor: the style's second colour for the top floor when it's a separate volume. */
export function wallColorFor(look: Look, floorIndex: number, floorCount: number) {
  return look.kit.upperVolume && floorCount > 1 && floorIndex === floorCount - 1 ? look.palette.wallAlt : look.palette.wall
}

/** Glass and main-door colours for a style. */
export function panelColors(look: Look) {
  return { glass: GLASS, door: look.palette.wood }
}

export function buildFacade(allModels: FloorModel[], plot: Plot, look: Look): Facade {
  const { kit, palette } = look
  const models = allModels.filter((m) => m.footprint)
  const solids: FacadeSolid[] = []
  const takeoff = new Map<RateKey, number>()
  const take = (key: RateKey, quantity: number) => quantity > 0 && takeoff.set(key, (takeoff.get(key) ?? 0) + quantity)
  if (models.length === 0) return { solids, takeoff: [], top: 0 }

  const front = frontSide(plot)
  const ground = models[0]
  const top = models[models.length - 1]
  const lift = (m: FloorModel) => m.floor.elevation + PLINTH_HEIGHT
  const exterior = (m: FloorModel) => m.walls.filter((w) => w.exterior && w.outside)
  const push = (solid: FacadeSolid) => solids.push(solid)

  // Plinth.
  push({ rect: ground.footprint!, z0: 0, z1: PLINTH_HEIGHT, color: palette.base, role: 'plinth', stage: 'plinth' })

  models.forEach((m, i) => {
    const base = lift(m)
    const wallH = wallHeightOf(m)
    const isTop = m === top
    const wallColor = wallColorFor(look, i, models.length)

    // Walls, cut around their doors and windows.
    for (const w of m.walls) {
      for (const box of wallBoxes(w, m.openings, wallH, w.exterior ? wallColor : MASSING_COLORS.wallInterior, undefined, panelColors(look))) {
        push({ ...box, z0: box.z0 + base, z1: box.z1 + base, stage: 'walls', floorId: m.floor.id })
      }
    }

    // Slab, and the band at its edge: a moulded band in the trim colour, or the slab edge in the wall colour.
    const fp = m.footprint!
    const slabTop = base + m.height
    push({ rect: fp, z0: slabTop - SLAB_THICKNESS, z1: slabTop, color: SLAB, role: 'slab', stage: 'frame', floorId: m.floor.id })
    if (!(isTop && kit.roof === 'hip')) {
      // It hangs down from just under the slab's top, so the terrace above shows the slab, not the band.
      const depth = kit.bands ? 0.55 : 0.3
      push({ rect: expand(fp, kit.bands ? 0.35 : 0.3), z0: slabTop - depth, z1: slabTop - 0.02, color: kit.bands ? palette.trim : wallColor, role: 'band', stage: 'frame', floorId: m.floor.id })
    }

    // Window sills, and what each style puts over its openings.
    for (const w of exterior(m)) {
      for (const o of m.openings.filter((op) => op.wall.id === w.id)) {
        const a = o.center - o.width / 2
        const b = o.center + o.width / 2
        if (!isDoor(o)) push({ rect: faceStrip(w, a - 0.25, b + 0.25, 0.3), z0: base + o.sill - 0.18, z1: base + o.sill, color: palette.trim, role: 'sill', stage: 'details' })
        const head = base + o.sill + o.height
        const jharokha = kit.shades === 'jharokha' && !isDoor(o) && w.outside === front && (m.floor.level > 0 || models.length === 1)
        if (jharokha) {
          addJharokha(w, a, b, base + o.sill, head)
          continue
        }
        if (o.kind === 'main-door' && kit.porch) continue
        // Deep tiled eaves (or a hip roof's) already shade the windows below them.
        if (kit.tiledBands) continue
        if (kit.shades === 'tiled') {
          const depth = 1.8
          push({ rect: faceStrip(w, a - 0.6, b + 0.6, depth), z0: head + 0.35, z1: head + 1.25, color: palette.roof, role: 'shade', shape: { kind: 'slope', inset: leanToInset(w.outside!, depth, 0.6) }, stage: 'details' })
          take('tiledShade', (b - a + 1.2) * depth)
        } else if (kit.shades === 'slab' || kit.shades === 'jharokha') {
          const depth = isDoor(o) ? 2 : 1.5
          push({ rect: faceStrip(w, a - 0.4, b + 0.4, depth), z0: head + 0.35, z1: head + 0.6, color: palette.trim, role: 'shade', stage: 'details' })
        }
      }
    }

    // Tiled eaves along the outer walls at each floor level (and round the roof of a flat-roofed top floor).
    if (kit.tiledBands && !(isTop && kit.roof === 'hip')) {
      const depth = 2.2
      const rise = depth * 0.5
      for (const w of exterior(m)) {
        const [a, b] = wallSpan(w)
        push({ rect: faceStrip(w, a - depth, b + depth, depth), z0: slabTop - rise, z1: slabTop, color: palette.roof, role: 'shade', shape: { kind: 'slope', inset: leanToInset(w.outside!, depth, depth) }, stage: isTop ? 'top' : 'details' })
        take('tiledShade', (b - a + depth) * depth)
      }
    }
  })

  function addJharokha(w: WallSegment, a: number, b: number, sill: number, head: number) {
    const depth = 1.8
    const color = palette.stone
    // Corbel, floor, corner posts, a low screen in front, and a canopy roof.
    push({ rect: faceStrip(w, a - 0.2, b + 0.2, 1.1), z0: sill - 1.1, z1: sill - 0.45, color, role: 'jharokha', stage: 'details' })
    push({ rect: faceStrip(w, a - 0.6, b + 0.6, depth), z0: sill - 0.45, z1: sill, color, role: 'jharokha', stage: 'details' })
    const outer = faceStrip(w, a - 0.6, b + 0.6, 0.35, depth - 0.35)
    const posts: Rect[] =
      w.orientation === 'h'
        ? [
            { ...outer, width: 0.35 },
            { ...outer, x: outer.x + outer.width - 0.35, width: 0.35 },
          ]
        : [
            { ...outer, height: 0.35 },
            { ...outer, y: outer.y + outer.height - 0.35, height: 0.35 },
          ]
    for (const rect of posts) push({ rect, z0: sill, z1: head + 0.3, color, role: 'jharokha', stage: 'details' })
    push({ rect: outer, z0: sill, z1: sill + 1.4, color: palette.wallAlt, role: 'jharokha', stage: 'details' })
    const roof = faceStrip(w, a - 0.9, b + 0.9, depth + 0.5, -0.1)
    push({ rect: roof, z0: head + 0.3, z1: head + 0.55, color: palette.trim, role: 'jharokha', stage: 'details' })
    push({ rect: roof, z0: head + 0.55, z1: head + 1.6, color, role: 'jharokha', shape: { kind: 'slope', inset: hipInset(roof) }, stage: 'details' })
    take('jharokha', 1)
  }

  // The top: a hip roof, or a parapet in the style's form.
  const roofBase = lift(top) + top.height
  if (kit.roof === 'hip') {
    const rect = expand(top.footprint!, kit.eaves)
    const rise = kit.pitch * (Math.min(rect.width, rect.height) / 2)
    push({ rect, z0: roofBase, z1: roofBase + rise, color: palette.roof, role: 'roof', shape: { kind: 'slope', inset: hipInset(rect) }, stage: 'top' })
    // Fascia boards along the eaves.
    const f = 0.12
    for (const edge of [
      { ...rect, height: f },
      { ...rect, y: rect.y + rect.height - f, height: f },
      { ...rect, width: f },
      { ...rect, x: rect.x + rect.width - f, width: f },
    ])
      push({ rect: edge, z0: roofBase - 0.45, z1: roofBase + 0.05, color: palette.wood, role: 'fascia', stage: 'top' })
    take('tileRoof', rect.width * rect.height * Math.sqrt(1 + kit.pitch * kit.pitch))
  } else {
    for (const w of exterior(top)) addParapet(w)
  }

  function addParapet(w: WallSegment) {
    const r = wallRect(w)
    const [a, b] = wallSpan(w)
    const length = b - a
    const along = (u0: number, u1: number): Rect => (w.orientation === 'h' ? { x: u0, y: r.y, width: u1 - u0, height: r.height } : { x: r.x, y: u0, width: r.width, height: u1 - u0 })
    const z0 = roofBase
    const wallColor = wallColorFor(look, models.length - 1, models.length)
    const coping = (z: number, rect: Rect, color: string) => push({ rect: expand(rect, 0.12), z0: z, z1: z + 0.22, color, role: 'coping', stage: 'top' })
    switch (kit.parapet) {
      case 'none':
        return
      case 'glass': {
        if (w.outside !== front) break
        push({ rect: r, z0, z1: z0 + 0.6, color: wallColor, role: 'parapet', stage: 'top' })
        push({ rect: along(a + 0.1, b - 0.1), z0: z0 + 0.6, z1: z0 + 3.4, color: RAILING_GLASS, opacity: 0.35, role: 'railing', stage: 'top' })
        push({ rect: along(a, b), z0: z0 + 3.4, z1: z0 + 3.55, color: palette.frame, role: 'railing', stage: 'top' })
        take('glassRailing', length)
        return
      }
      case 'crenellated': {
        const body = 2.6
        push({ rect: r, z0, z1: z0 + body, color: wallColor, role: 'parapet', stage: 'top' })
        coping(z0 + body, r, palette.trim)
        const merlon = 1.2
        const count = Math.max(1, Math.floor((length + merlon) / (merlon * 2)))
        const start = a + (length - (count * 2 - 1) * merlon) / 2
        for (let k = 0; k < count; k++) {
          const u = start + k * merlon * 2
          push({ rect: along(u, u + merlon), z0: z0 + body + 0.22, z1: z0 + body + 1.5, color: wallColor, role: 'parapet', stage: 'top' })
        }
        take('decorativeParapet', length)
        return
      }
      case 'balustrade': {
        const post = 0.9
        const bays = Math.max(1, Math.round(length / 6))
        const step = (length - post) / bays
        push({ rect: r, z0, z1: z0 + 1, color: wallColor, role: 'parapet', stage: 'top' })
        push({ rect: along(a, b), z0: z0 + 1, z1: z0 + 3, color: palette.wallAlt, role: 'parapet', stage: 'top' })
        push({ rect: expand(along(a, b), 0.08), z0: z0 + 3, z1: z0 + 3.3, color: palette.trim, role: 'coping', stage: 'top' })
        for (let k = 0; k <= bays; k++) {
          const u = a + k * step
          const rect = expand(along(u, u + post), 0.1)
          push({ rect, z0, z1: z0 + 3.9, color: wallColor, role: 'parapet', stage: 'top' })
          coping(z0 + 3.9, rect, palette.trim)
        }
        take('decorativeParapet', length)
        return
      }
      case 'slim':
        push({ rect: r, z0, z1: z0 + 3, color: wallColor, role: 'parapet', stage: 'top' })
        push({ rect: expand(r, 0.08), z0: z0 + 3, z1: z0 + 3.15, color: palette.trim, role: 'coping', stage: 'top' })
        return
      default:
        break
    }
    push({ rect: r, z0, z1: z0 + PARAPET_HEIGHT, color: wallColor, role: 'parapet', stage: 'top' })
    coping(z0 + PARAPET_HEIGHT, r, kit.bands ? palette.trim : MASSING_COLORS.parapetCap)
  }

  // The entrance: pillars and a tiled or flat roof in front of the main door.
  const main = ground.openings.find((o) => o.kind === 'main-door' && o.wall.exterior && o.wall.outside)
  if (kit.porch && main) {
    const w = main.wall
    const side = w.outside!
    const room = roomOutside(plot, w)
    const [s0, s1] = wallSpan(w)
    const width = Math.min(s1 - s0, Math.max(main.width + 6, 10))
    const a = Math.min(Math.max(main.center - width / 2, s0), s1 - width)
    const b = a + width
    const depth = Math.min(kit.porch.depth, room - 1)
    const base = lift(ground)
    const wallH = wallHeightOf(ground)
    if (depth >= 2.5) {
      const deck = faceStrip(w, a, b, depth)
      push({ rect: deck, z0: 0, z1: PLINTH_HEIGHT - 0.05, color: palette.stone, role: 'porch', stage: 'details' })
      const pillared = depth >= 4
      const pillar = kit.porch.pillars === 'square' ? 1.2 : 0.85
      const eave = 0.8
      const roofHigh = base + wallH + 0.2
      const roofLow = roofHigh - Math.min(depth * 0.45, 2.6) - eave * 0.45
      const pillarOut = depth - pillar - 0.4
      // A tiled roof's underside where the pillars stand; a flat portico slab's soffit.
      const pillarTop = kit.porch.roof === 'tiled' ? roofHigh - (roofHigh - roofLow) * ((pillarOut + pillar / 2) / (depth + eave)) - 0.1 : base + wallH
      if (pillared) {
        const count = width > 14 ? 3 : 2
        const line = faceStrip(w, a + 0.5, b - 0.5, pillar, pillarOut)
        for (let k = 0; k < count; k++) {
          const t = k / (count - 1)
          const rect: Rect =
            w.orientation === 'h'
              ? { x: line.x + t * (line.width - pillar), y: line.y, width: pillar, height: pillar }
              : { x: line.x, y: line.y + t * (line.height - pillar), width: pillar, height: pillar }
          push({ rect: expand(rect, 0.2), z0: PLINTH_HEIGHT - 0.05, z1: PLINTH_HEIGHT + 0.6, color: palette.stone, role: 'pillar', stage: 'details' })
          push({ rect, z0: PLINTH_HEIGHT + 0.6, z1: pillarTop - 0.35, color: kit.porch.pillars === 'round-wood' ? palette.wood : kit.porch.pillars === 'square' ? palette.wall : palette.stone, role: 'pillar', shape: kit.porch.pillars === 'square' ? undefined : { kind: 'cylinder' }, stage: 'details' })
          push({ rect: expand(rect, 0.15), z0: pillarTop - 0.35, z1: pillarTop, color: palette.trim, role: 'pillar', stage: 'details' })
        }
        take(kit.porch.pillars === 'round-wood' ? 'pillarWood' : kit.porch.pillars === 'square' ? 'pillarRcc' : 'pillarStone', count)
      }
      if (kit.porch.roof === 'tiled') {
        const rect = faceStrip(w, a - eave, b + eave, depth + eave)
        push({ rect, z0: roofLow, z1: roofHigh, color: palette.roof, role: 'shade', shape: { kind: 'slope', inset: leanToInset(side, depth + eave, eave + 0.6) }, stage: 'details' })
        take('tiledShade', rect.width * rect.height)
      } else {
        const rect = faceStrip(w, a - 0.4, b + 0.4, depth + 0.4)
        push({ rect, z0: base + wallH, z1: base + wallH + 0.55, color: palette.trim, role: 'porch', stage: 'details' })
        // A low balustrade round the portico roof.
        const rail = faceStrip(w, a - 0.4, b + 0.4, 0.5, depth - 0.1)
        push({ rect: rail, z0: base + wallH + 0.55, z1: base + wallH + 2.6, color: palette.wallAlt, role: 'porch', stage: 'details' })
        take('porchSlab', rect.width * rect.height)
      }
    }
  }

  // Cladding on the ground floor: wood round the entrance, brick across the front, or a sandstone base all round.
  if (kit.cladding !== 'none') {
    const base = lift(ground)
    const wallH = wallHeightOf(ground)
    const color = kit.cladding === 'wood' ? palette.wood : palette.stone
    const key: RateKey = kit.cladding === 'wood' ? 'woodCladding' : kit.cladding === 'brick' ? 'brickCladding' : 'stoneCladding'
    for (const w of exterior(ground)) {
      const [s0, s1] = wallSpan(w)
      let range: [number, number] | null = null
      let height = wallH
      if (kit.cladding === 'stone') {
        range = [s0, s1]
        height = 3
      } else if (w.outside === front) {
        if (kit.cladding === 'brick') range = [s0, s1]
        else if (main && main.wall.id === w.id) range = [Math.max(s0, main.center - main.width / 2 - 2.5), Math.min(s1, main.center + main.width / 2 + 2.5)]
      }
      if (!range) continue
      for (const piece of aroundOpenings(w, ground.openings, range[0], range[1], 0, height)) {
        push({ rect: faceStrip(w, piece.a, piece.b, 0.1), z0: base + piece.z0, z1: base + piece.z1, color, role: 'cladding', stage: 'details' })
        take(key, (piece.b - piece.a) * (piece.z1 - piece.z0))
      }
    }
  }

  // On the terrace: a pergola, a chhatri, or domes on the parapet corners.
  const fp = top.footprint!
  if (kit.pergola && kit.roof === 'flat' && fp.width > 14 && fp.height > 14) {
    const depth = Math.min(10, (front === 'N' || front === 'S' ? fp.height : fp.width) * 0.4)
    const inset = 2.5
    const span: Rect = front === 'N' || front === 'S' ? { x: fp.x + inset, y: 0, width: fp.width - inset * 2, height: depth } : { x: 0, y: fp.y + inset, width: depth, height: fp.height - inset * 2 }
    if (front === 'N') span.y = fp.y + inset
    if (front === 'S') span.y = fp.y + fp.height - inset - depth
    if (front === 'W') span.x = fp.x + inset
    if (front === 'E') span.x = fp.x + fp.width - inset - depth
    const post = 0.45
    const h = 7.5
    for (const [px, py] of [
      [span.x, span.y],
      [span.x + span.width - post, span.y],
      [span.x, span.y + span.height - post],
      [span.x + span.width - post, span.y + span.height - post],
    ])
      push({ rect: { x: px, y: py, width: post, height: post }, z0: roofBase, z1: roofBase + h, color: palette.frame, role: 'pergola', stage: 'details' })
    const alongX = span.width >= span.height
    for (const offset of [0, alongX ? span.height - 0.4 : span.width - 0.4])
      push({ rect: alongX ? { x: span.x, y: span.y + offset, width: span.width, height: 0.4 } : { x: span.x + offset, y: span.y, width: 0.4, height: span.height }, z0: roofBase + h - 0.6, z1: roofBase + h, color: palette.frame, role: 'pergola', stage: 'details' })
    const slats = Math.floor((alongX ? span.width : span.height) / 1.4)
    for (let k = 0; k <= slats; k++) {
      const u = k * 1.4
      push({ rect: alongX ? { x: span.x + u, y: span.y - 0.3, width: 0.25, height: span.height + 0.6 } : { x: span.x - 0.3, y: span.y + u, width: span.width + 0.6, height: 0.25 }, z0: roofBase + h, z1: roofBase + h + 0.5, color: palette.wood, role: 'pergola', stage: 'details' })
    }
    take('pergola', span.width * span.height)
  }

  if (kit.domes === 'chhatri' && kit.roof === 'flat' && fp.width > 12 && fp.height > 12) {
    // At the front corner on the left as seen from the road.
    const size = 6
    const corner = { N: [fp.x + fp.width - size - 1.5, fp.y + 1.5], S: [fp.x + 1.5, fp.y + fp.height - size - 1.5], E: [fp.x + fp.width - size - 1.5, fp.y + fp.height - size - 1.5], W: [fp.x + 1.5, fp.y + 1.5] }[front]
    const sq: Rect = { x: corner[0], y: corner[1], width: size, height: size }
    const p = 0.6
    for (const [px, py] of [
      [sq.x, sq.y],
      [sq.x + size - p, sq.y],
      [sq.x, sq.y + size - p],
      [sq.x + size - p, sq.y + size - p],
    ])
      push({ rect: { x: px, y: py, width: p, height: p }, z0: roofBase, z1: roofBase + 6, color: palette.stone, role: 'dome', stage: 'details' })
    push({ rect: expand(sq, 0.5), z0: roofBase + 6, z1: roofBase + 6.5, color: palette.trim, role: 'dome', stage: 'details' })
    push({ rect: expand(sq, -0.4), z0: roofBase + 6.5, z1: roofBase + 9.3, color: palette.stone, role: 'dome', shape: { kind: 'dome' }, stage: 'details' })
    push({ rect: { x: sq.x + size / 2 - 0.15, y: sq.y + size / 2 - 0.15, width: 0.3, height: 0.3 }, z0: roofBase + 9.2, z1: roofBase + 10.2, color: palette.trim, role: 'dome', stage: 'details' })
    take('chhatri', 1)
  }

  if (kit.domes === 'corners' && kit.roof === 'flat') {
    const pier = 1.7
    for (const [px, py] of [
      [fp.x - 0.15, fp.y - 0.15],
      [fp.x + fp.width - pier + 0.15, fp.y - 0.15],
      [fp.x - 0.15, fp.y + fp.height - pier + 0.15],
      [fp.x + fp.width - pier + 0.15, fp.y + fp.height - pier + 0.15],
    ]) {
      const rect = { x: px, y: py, width: pier, height: pier }
      push({ rect, z0: roofBase, z1: roofBase + 4.4, color: palette.wall, role: 'dome', stage: 'top' })
      push({ rect: expand(rect, 0.12), z0: roofBase + 4.4, z1: roofBase + 4.65, color: palette.trim, role: 'dome', stage: 'top' })
      push({ rect: expand(rect, -0.1), z0: roofBase + 4.65, z1: roofBase + 5.9, color: palette.trim, role: 'dome', shape: { kind: 'dome' }, stage: 'top' })
    }
    take('dome', 4)
  }

  return {
    solids,
    takeoff: [...takeoff.entries()].map(([key, quantity]) => ({ key, quantity: Math.round(quantity * 10) / 10 })),
    top: Math.max(...solids.map((s) => s.z1)),
  }
}
