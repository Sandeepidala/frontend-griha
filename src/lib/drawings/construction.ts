import type { BoqEstimate } from '@/lib/boq'
import type { RateKey } from '@/lib/boq/rates'
import type { ProjectBrief } from '@/types/brief'
import type { Floor, Plot } from '@/types/design'
import { lookFor } from '@/lib/style/kits'
import { type FacadeSolid, buildFacade, panelColors, wallColorFor } from './facade'
import { type Rect, type Side, type WallSegment, PLINTH_HEIGHT, frontSide, wallRect } from './geometry'
import { type Box, MASSING_COLORS, wallBoxes, wallHeightOf } from './massing'
import { type Column, deriveBeams, deriveFootings } from './services'
import { buildDrawingSet } from './sheets'
import { compoundWallRects, driveway, gateRect, landscapeLayout, siteContext } from './site'

/**
 * The build sequence for the "watch it get built" animation: every part of the building in the
 * order a site would build it (marking out, footings, plinth, then each floor's frame, walls and
 * openings, the parapet, finishing, and the compound and garden), with when it appears in the
 * animation, how many weeks each stage indicatively takes and what it costs from the estimate.
 *
 * Plan feet, heights in feet from the ground. When the sequence ends, the building pieces are
 * exactly the 3D model's (the house in its style, lib/drawings/facade): the structure hidden inside
 * the walls is gone, and the raw brick and concrete have turned into the finished colours.
 */

export const RAW_COLORS = {
  brick: '#b4643f',
  concrete: '#a19d96',
  earth: '#5e4634',
  soil: '#a88b6c',
  plinthFill: '#8c8172',
  marking: '#f4f1ea',
  peg: '#e0a83a',
  gate: '#3f3f46',
  compound: '#d2c9bb',
  paving: '#d9cfbf',
}

/** How a piece appears: rising from its base, growing out of its centre, or spreading from one side. */
export type Growth = 'up' | 'pop' | 'sweep'

export interface BuildPiece extends Box {
  /** Seconds into the animation when the piece starts to appear, and when it is complete. */
  start: number
  end: number
  growth: Growth
  /** For a sweep: the side it spreads from. */
  from?: Side
  /** Its colour while under construction (raw brick, concrete); it turns into `color` while finishing. */
  raw?: string
  /** Gone from this time on: pits backfilled, the structure inside the finished walls. */
  until?: number
  /** Part of the finished building (as the 3D model shows it), the site works, or a stage of the work only. */
  part: 'building' | 'site' | 'temporary'
}

export interface BuildGreenery {
  kind: 'tree' | 'shrub'
  x: number
  y: number
  r: number
  start: number
  end: number
}

export interface BuildStage {
  id: string
  title: string
  detail: string
  /** Seconds into the animation. */
  start: number
  end: number
  /** Indicative weeks on site, from the start of work. */
  weekStart: number
  weekEnd: number
  /** Its share of the estimate, ₹; 0 when there's no estimate. */
  cost: number
  /** Spent by the end of this stage, ₹. */
  spent: number
}

export interface BuildSequence {
  plot: Plot
  pieces: BuildPiece[]
  greenery: BuildGreenery[]
  stages: BuildStage[]
  /** Seconds, including a short hold on the finished house. */
  duration: number
  /** When the raw brick and concrete turn into the finished colours. */
  finish: { start: number; end: number }
  /** When the bare plot turns into lawn. */
  lawn: { start: number; end: number }
  road: Rect
  /** Top of the building (parapet coping), ft. */
  height: number
  totalWeeks: number
  totalCost: number | null
  /** The estimate's budget, when there is one. */
  budget: number | null
}

export interface BuildInput {
  plot: Plot
  floors: Floor[]
  brief: ProjectBrief | null
  /** The cost estimate for these floors; stage costs come from its sections. */
  estimate: BoqEstimate | null
}

const OPENING_RATES = new Set<RateKey>(['mainDoor', 'internalDoor', 'bathroomDoor', 'window', 'ventilator'])
const HOLD_SECONDS = 1.6
const COMPOUND_HEIGHT = 5
const GATE_HEIGHT = 4.5

/** How far a rect is from the road side, as a 0–1 fraction across the plot (for sweeping from the front). */
function fromFront(plot: Plot, front: Side, rect: Rect) {
  switch (front) {
    case 'N':
      return rect.y / plot.height
    case 'S':
      return 1 - (rect.y + rect.height) / plot.height
    case 'W':
      return rect.x / plot.width
    case 'E':
      return 1 - (rect.x + rect.width) / plot.width
  }
}

function columnRect(c: Column, grow = 0): Rect {
  return { x: c.x - c.width / 2 - grow, y: c.y - c.depth / 2 - grow, width: c.width + grow * 2, height: c.depth + grow * 2 }
}

function insideRect(outer: Rect, x: number, y: number, tolerance: number) {
  return x >= outer.x - tolerance && x <= outer.x + outer.width + tolerance && y >= outer.y - tolerance && y <= outer.y + outer.height + tolerance
}

const lift = (box: Box, by: number): Box => ({ ...box, z0: box.z0 + by, z1: box.z1 + by })

export function constructionSequence({ plot, floors, brief, estimate }: BuildInput): BuildSequence {
  const set = buildDrawingSet(plot, floors, '', '', { brief })
  const models = set.models.filter((m) => m.footprint)
  const look = lookFor(brief)
  const facade = buildFacade(set.models, plot, look)
  const facadeOf = (stage: FacadeSolid['stage'], floorId?: string) => facade.solids.filter((s) => s.stage === stage && (!floorId || s.floorId === floorId))
  const site = siteContext(set)
  const front = frontSide(plot)
  const columns = set.columns
  const footings = deriveFootings(columns)

  const pieces: BuildPiece[] = []
  const greenery: BuildGreenery[] = []
  const stages: BuildStage[] = []
  const costs = new Map<string, number>()
  let clock = 0
  let week = 0

  function stage(id: string, title: string, detail: string, seconds: number, weeks: number) {
    const s: BuildStage = { id, title, detail, start: clock, end: clock + seconds, weekStart: week, weekEnd: week + weeks, cost: 0, spent: 0 }
    clock += seconds
    week += weeks
    stages.push(s)
    return s
  }
  /** Start and end for the i-th of n pieces, staggered through part of a stage. */
  function stagger(s: BuildStage, order: number, from = 0, to = 1, overlap = 0.55) {
    const length = (s.end - s.start) * (to - from)
    const each = length * (1 - overlap)
    const start = s.start + (s.end - s.start) * from + (length - each) * Math.min(1, Math.max(0, order))
    return { start, end: start + each }
  }
  const byFront = <T>(items: T[], rectOf: (item: T) => Rect) =>
    items.map((item) => ({ item, order: fromFront(plot, front, rectOf(item)) })).sort((a, b) => a.order - b.order)
  const rank = (i: number, n: number) => (n <= 1 ? 0 : i / (n - 1))

  // The finishing window is known only later; pieces that vanish then point at this.
  const finishRefs: BuildPiece[] = []

  // 1. Site marked out.
  const marking = stage('site', 'Site cleared and marked out', "The plot is cleared, and the building's outline is marked on the ground with lime.", 1.6, 1)
  const pegs: Rect[] = [
    { x: 0, y: 0, width: 0.35, height: 0.35 },
    { x: plot.width - 0.35, y: 0, width: 0.35, height: 0.35 },
    { x: plot.width - 0.35, y: plot.height - 0.35, width: 0.35, height: 0.35 },
    { x: 0, y: plot.height - 0.35, width: 0.35, height: 0.35 },
  ]
  const pegRefs: BuildPiece[] = pegs.map((rect, i) => ({ rect, z0: 0, z1: 1.4, color: RAW_COLORS.peg, ...stagger(marking, rank(i, 4), 0, 0.4), growth: 'up', part: 'temporary' }))
  pieces.push(...pegRefs)
  const ground = models[0]
  const outlineRefs: BuildPiece[] = []
  if (ground?.footprint) {
    const fp = ground.footprint
    const t = 0.25
    const lines: Rect[] = [
      { x: fp.x, y: fp.y, width: fp.width, height: t },
      { x: fp.x, y: fp.y + fp.height - t, width: fp.width, height: t },
      { x: fp.x, y: fp.y, width: t, height: fp.height },
      { x: fp.x + fp.width - t, y: fp.y, width: t, height: fp.height },
    ]
    lines.forEach((rect, i) => {
      const piece: BuildPiece = { rect, z0: 0, z1: 0.04, color: RAW_COLORS.marking, ...stagger(marking, rank(i, 4), 0.35, 1), growth: 'sweep', from: front, part: 'temporary' }
      pieces.push(piece)
      outlineRefs.push(piece)
    })
  }

  // 2–4. Foundations.
  const foundationCost = sectionTotal(estimate, 'foundation')
  const dig = stage('excavation', 'Excavation for the footings', `Pits are dug for the footings, one under each of the ${columns.length} columns.`, 1.4, 1)
  costs.set('excavation', foundationCost * 0.15)
  const pitRefs: BuildPiece[] = []
  byFront(footings, (f) => columnRect(f.column, f.size / 2)).forEach(({ item: f }, i, all) => {
    const size = f.size + 0.75
    const rect = { x: f.column.x - size / 2, y: f.column.y - size / 2, width: size, height: size }
    const piece: BuildPiece = { rect, z0: 0, z1: 0.02, color: RAW_COLORS.earth, ...stagger(dig, rank(i, all.length)), growth: 'pop', part: 'temporary' }
    pieces.push(piece)
    pitRefs.push(piece)
  })

  const cast = stage('footings', 'Footings cast', 'Reinforced concrete footings are cast at the bottom of each pit.', 1.4, 2)
  costs.set('footings', foundationCost * 0.45)
  byFront(footings, (f) => columnRect(f.column, f.size / 2)).forEach(({ item: f }, i, all) => {
    const rect = { x: f.column.x - f.size / 2, y: f.column.y - f.size / 2, width: f.size, height: f.size }
    const piece: BuildPiece = { rect, z0: 0.02, z1: 0.75, color: RAW_COLORS.concrete, ...stagger(cast, rank(i, all.length)), growth: 'up', part: 'temporary' }
    pieces.push(piece)
    pitRefs.push(piece)
  })

  const plinth = stage('plinth', 'Plinth beams and plinth', 'Columns rise to plinth level, plinth beams tie them together, and the plinth is filled and compacted.', 2.2, 2)
  costs.set('plinth', foundationCost * 0.4)
  for (const c of columns) {
    const piece: BuildPiece = { rect: columnRect(c, 0.03), z0: 0.75, z1: PLINTH_HEIGHT, color: RAW_COLORS.concrete, ...stagger(plinth, 0, 0, 0.3, 0), growth: 'up', part: 'temporary' }
    pieces.push(piece)
    finishRefs.push(piece)
  }
  if (ground) {
    byFront(ground.walls, wallRect).forEach(({ item: w }, i, all) => {
      const piece: BuildPiece = { rect: wallRect(w), z0: PLINTH_HEIGHT - 1, z1: PLINTH_HEIGHT - 0.05, color: RAW_COLORS.concrete, ...stagger(plinth, rank(i, all.length), 0.25, 0.6), growth: 'up', part: 'temporary' }
      pieces.push(piece)
      finishRefs.push(piece)
    })
    for (const box of facadeOf('plinth')) pieces.push({ ...box, raw: RAW_COLORS.plinthFill, ...stagger(plinth, 0, 0.55, 1, 0), growth: 'up', part: 'building' })
  }
  // The pits are backfilled and the outline is covered once the plinth is done.
  for (const p of [...pitRefs, ...outlineRefs]) p.until = plinth.end

  // 5. Each floor: frame, walls, openings.
  const structureCost = sectionTotal(estimate, 'structure')
  const wallsCost = sectionTotal(estimate, 'walls')
  const areas = models.map((m) => m.footprint!.width * m.footprint!.height)
  const totalArea = areas.reduce((s, a) => s + a, 0) || 1
  const openingsCost = new Map<string, number>()
  let roomFinishes = 0
  for (const s of estimate?.sections ?? []) {
    if (s.kind !== 'room') continue
    for (const line of s.lines) {
      if (OPENING_RATES.has(line.rateKey) && s.floorId) openingsCost.set(s.floorId, (openingsCost.get(s.floorId) ?? 0) + line.amount)
      else roomFinishes += line.amount
    }
  }

  models.forEach((model, i) => {
    const base = model.floor.elevation + PLINTH_HEIGHT
    const wallH = wallHeightOf(model)
    const share = areas[i] / totalArea
    const name = model.floor.name

    const frame = stage(`frame-${model.floor.id}`, `${name}: columns, beams and slab`, 'Columns go up, then the beams and the roof slab are cast together.', 2.2, 4)
    costs.set(frame.id, structureCost * share)
    const fp = model.footprint!
    for (const c of columns.filter((col) => insideRect(fp, col.x, col.y, 0.6))) {
      const piece: BuildPiece = { rect: columnRect(c, 0.03), z0: base, z1: base + wallH, color: RAW_COLORS.concrete, ...stagger(frame, 0, 0, 0.35, 0), growth: 'up', part: 'temporary' }
      pieces.push(piece)
      finishRefs.push(piece)
    }

    // Each wall's top band is its beam, cast with the slab; the brickwork below fills in afterwards.
    const masonry: { box: Box; wall: WallSegment }[] = []
    const openings: Box[] = []
    const beams: { box: Box; wall: WallSegment }[] = []
    for (const w of model.walls) {
      const finished = w.exterior ? wallColorFor(look, i, models.length) : MASSING_COLORS.wallInterior
      const highestOpening = model.openings.filter((o) => o.wall.id === w.id).reduce((top, o) => Math.max(top, o.sill + o.height), 0)
      const depth = Math.max(...deriveBeams([w], columns).map((b) => b.depthMm / 304.8), 1)
      const soffit = Math.min(wallH, Math.max(wallH - depth, highestOpening))
      if (soffit < wallH) beams.push({ box: { rect: wallRect(w), z0: soffit, z1: wallH, color: finished, role: w.exterior ? 'wall' : 'wall-interior' }, wall: w })
      for (const box of wallBoxes(w, model.openings, wallH, finished, undefined, panelColors(look))) {
        if (box.role === 'glass' || box.role === 'door') {
          openings.push(box)
          continue
        }
        const top = Math.min(box.z1, soffit)
        if (top > box.z0 + 0.001) masonry.push({ box: { ...box, z1: top }, wall: w })
      }
    }
    byFront(beams, (b) => b.box.rect).forEach(({ item }, j, all) =>
      pieces.push({ ...lift(item.box, base), raw: RAW_COLORS.concrete, ...stagger(frame, rank(j, all.length), 0.3, 0.7), growth: 'up', part: 'building' }),
    )
    for (const box of facadeOf('frame', model.floor.id)) {
      pieces.push({ ...box, raw: RAW_COLORS.concrete, ...stagger(frame, 0, 0.6, 1, 0), growth: 'sweep', from: front, part: 'building' })
    }

    const walls = stage(`walls-${model.floor.id}`, `${name}: brick walls`, 'Brick walls are built up between the columns, leaving the door and window openings.', 2.6, 3)
    costs.set(walls.id, wallsCost * 0.7 * share)
    // The brickwork rises course by course: a piece starts when the course reaches its bottom.
    const level = Math.max(...masonry.map((m) => m.box.z1), 1)
    const span = walls.end - walls.start
    for (const { box, wall } of masonry) {
      const delay = 0.15 * span * fromFront(plot, front, wallRect(wall))
      const rise = span * 0.85
      pieces.push({
        ...lift(box, base),
        raw: RAW_COLORS.brick,
        start: walls.start + delay + (box.z0 / level) * rise,
        end: walls.start + delay + (box.z1 / level) * rise,
        growth: 'up',
        part: 'building',
      })
    }

    const frames = stage(`openings-${model.floor.id}`, `${name}: doors and windows`, 'Door frames and windows are fixed in the openings.', 1, 1)
    costs.set(frames.id, openingsCost.get(model.floor.id) ?? 0)
    byFront(openings, (b) => b.rect).forEach(({ item }, j, all) => pieces.push({ ...lift(item, base), ...stagger(frames, rank(j, all.length), 0, 1, 0.7), growth: 'pop', part: 'building' }))
  })

  // 6. The roof: a parapet round the terrace, or the style's sloped roof.
  const topSolids = facadeOf('top')
  if (models.length > 0 && topSolids.length > 0) {
    const sloped = look.kit.roof === 'hip'
    const parapet = sloped
      ? stage('parapet', 'Roof: timber frame and clay tiles', 'The roof frame goes up over the top floor and is covered in clay tiles, with wide eaves all round.', 1.6, 2)
      : stage('parapet', 'Parapet and terrace', 'The parapet goes up around the terrace, and the roof is waterproofed.', 1.2, 1)
    costs.set('parapet', wallsCost * 0.1)
    for (const box of topSolids) {
      const late = box.role === 'coping' || box.role === 'railing' || box.role === 'fascia' || box.shape?.kind === 'dome'
      const raw = box.role === 'parapet' ? RAW_COLORS.brick : box.role === 'coping' || box.role === 'dome' ? RAW_COLORS.concrete : undefined
      pieces.push({ ...box, raw, ...stagger(parapet, 0, late ? 0.6 : 0, late ? 1 : 0.7, 0), growth: 'up', part: 'building' })
    }
  }

  // 7. The style's details: sit-out, sunshades, cladding, jharokhas, pergola, chhatri.
  const details = facadeOf('details')
  if (details.length > 0) {
    const has = (...roles: Box['role'][]) => details.some((d) => roles.includes(d.role))
    const named = [
      has('pillar', 'porch') ? 'the sit-out' : null,
      has('jharokha') ? 'the jharokhas' : null,
      has('shade') ? 'the sunshades' : null,
      has('cladding') ? 'the cladding' : null,
      has('pergola') ? 'the pergola' : null,
      has('dome') ? (look.kit.domes === 'chhatri' ? 'the chhatri' : 'the domes') : null,
    ].filter((n): n is string => !!n)
    const list = named.length ? named.join(', ').replace(/, ([^,]*)$/, ' and $1') : 'the window sills'
    const detail = stage('details', `${look.kit.name} details`, `${list.replace(/^./, (c) => c.toUpperCase())} go up, finishing the ${look.kit.name.toLowerCase()} look.`, 1.6, 2)
    costs.set('details', sectionTotal(estimate, 'style'))
    byFront(details, (d) => d.rect).forEach(({ item }, j, all) => {
      const tiles = item.shape?.kind === 'slope' && item.color === look.palette.roof
      const raw = tiles || item.role === 'cladding' || item.role === 'pergola' || item.color === look.palette.wood ? undefined : RAW_COLORS.concrete
      const growth = item.role === 'pillar' || item.role === 'pergola' || item.role === 'cladding' ? 'up' : 'pop'
      pieces.push({ ...item, raw, ...stagger(detail, rank(j, all.length), 0, 1, 0.75), growth, part: 'building' })
    })
  }

  // 8. Finishing: services, plaster and paint, the rooms' finishes (and interiors on a turnkey budget).
  const interiors = !!estimate?.includeInteriors
  const finishing = stage(
    'finishing',
    interiors ? 'Services, plaster, paint and interiors' : 'Services, plaster and paint',
    interiors
      ? 'Pipes and wiring go in, the walls are plastered and painted, floors are laid, and the interiors are fitted.'
      : 'Pipes and wiring go in, the walls are plastered and painted, and the floors and fittings are laid.',
    2.6,
    interiors ? 12 : 8,
  )
  costs.set('finishing', sectionTotal(estimate, 'services') + wallsCost * 0.2 + roomFinishes)
  for (const p of finishRefs) p.until = finishing.start

  // 9. The compound, gate, drive and garden.
  const outside = stage('outside', 'Compound wall, gate and garden', 'The compound wall, gate, drive and garden finish the site.', 2, 2)
  const compound = compoundWallRects(site)
  byFront(compound, (r) => r).forEach(({ item: rect }, i, all) =>
    pieces.push({ rect, z0: 0, z1: COMPOUND_HEIGHT, color: RAW_COLORS.compound, ...stagger(outside, rank(i, all.length), 0, 0.5), growth: 'up', part: 'site' }),
  )
  pieces.push({ rect: gateRect(site), z0: 0, z1: GATE_HEIGHT, color: RAW_COLORS.gate, ...stagger(outside, 0, 0.4, 0.6, 0), growth: 'pop', part: 'site' })
  const drive = driveway(site)
  if (drive) pieces.push({ rect: drive, z0: 0, z1: 0.06, color: RAW_COLORS.paving, ...stagger(outside, 0, 0.45, 0.75, 0), growth: 'sweep', from: front, part: 'site' })
  const landscape = landscapeLayout(set)
  const plants = [...landscape.trees.map((t) => ({ kind: 'tree' as const, ...t })), ...landscape.shrubs.map((s) => ({ kind: 'shrub' as const, ...s }))]
  plants.forEach((p, i) => greenery.push({ ...p, ...stagger(outside, rank(i, plants.length), 0.6, 1, 0.6) }))
  for (const p of pegRefs) p.until = outside.start

  // Costs: each stage's share of the estimate's items, scaled so the stages add up to its total (overheads included).
  const base = stages.reduce((s, st) => s + (costs.get(st.id) ?? 0), 0)
  const scale = estimate && base > 0 ? estimate.total / base : 0
  let spent = 0
  for (const st of stages) {
    st.cost = Math.round((costs.get(st.id) ?? 0) * scale)
    spent += st.cost
    st.spent = spent
  }
  // Rounding: the last stage that costs anything makes the sum exact.
  if (estimate && base > 0) {
    const last = [...stages].reverse().find((st) => st.cost > 0)
    if (last) {
      const drift = estimate.total - spent
      last.cost += drift
      for (const st of stages.slice(stages.indexOf(last))) st.spent += drift
    }
  }

  return {
    plot,
    pieces,
    greenery,
    stages,
    duration: clock + HOLD_SECONDS,
    finish: { start: finishing.start, end: finishing.end },
    lawn: { start: outside.start + (outside.end - outside.start) * 0.35, end: outside.start + (outside.end - outside.start) * 0.7 },
    road: site.road,
    height: Math.max(PLINTH_HEIGHT, ...pieces.map((p) => p.z1)),
    totalWeeks: week,
    totalCost: estimate && base > 0 ? estimate.total : null,
    budget: estimate?.budget?.amount ?? null,
  }
}

function sectionTotal(estimate: BoqEstimate | null, id: string) {
  return estimate?.sections.find((s) => s.id === id)?.subtotal ?? 0
}

/** The stage under way at a time in the animation (the last one once it's over). */
export function stageAt(sequence: BuildSequence, time: number): BuildStage | null {
  const { stages } = sequence
  if (!stages.length) return null
  return stages.find((s) => time < s.end) ?? stages[stages.length - 1]
}

/** Spent by a time in the animation, ₹: stages done, plus the running share of the one under way. */
export function spentAt(sequence: BuildSequence, time: number) {
  let spent = 0
  for (const s of sequence.stages) {
    if (time >= s.end) spent = s.spent
    else {
      if (time > s.start) spent += s.cost * ((time - s.start) / (s.end - s.start))
      break
    }
  }
  return spent
}

/** The week on site at a time in the animation. */
export function weekAt(sequence: BuildSequence, time: number) {
  const s = stageAt(sequence, time)
  if (!s) return 0
  const f = Math.min(1, Math.max(0, (time - s.start) / (s.end - s.start)))
  return Math.max(1, Math.ceil(s.weekStart + (s.weekEnd - s.weekStart) * f))
}

/** How far a piece has grown at a time, 0–1 (0: not there yet or gone). */
export function pieceProgress(piece: BuildPiece, time: number) {
  if (piece.until !== undefined && time >= piece.until) return 0
  if (time <= piece.start) return 0
  if (time >= piece.end) return 1
  return (time - piece.start) / (piece.end - piece.start)
}

