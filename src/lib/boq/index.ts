import {
  SLAB_THICKNESS,
  frontSide,
  isDoor,
  wallLength,
  wallsArea,
  type FloorModel,
  type PlanOpening,
  type PlanRoom,
  type WallSegment,
} from '@/lib/drawings/geometry'
import type { PlacedItem } from '@/lib/drawings/interior'
import { ceilingPlan } from '@/lib/drawings/interior'
import {
  FOOTING_TYPES,
  deriveBeams,
  deriveFootings,
  deriveSlabs,
  designStair,
  drainagePlan,
  electricalPlan,
  pathLength,
  waterSupplyPlan,
  type ElecKind,
} from '@/lib/drawings/services'
import { buildDrawingSet } from '@/lib/drawings/sheets'
import type { ProjectBrief } from '@/types/brief'
import type { Floor, FloorFinish, Plot, RoomType } from '@/types/design'
import { OVERHEADS, RATES, RATES_AS_OF, locationFactor, type RateKey, type RateUnit } from './rates'

export { RATES, RATES_AS_OF, UNIT_LABELS } from './rates'

export interface BoqLine {
  id: string
  rateKey: RateKey
  description: string
  quantity: number
  unit: RateUnit
  /** ₹ per unit, after the location factor. */
  rate: number
  amount: number
  /** Interiors and fittings that only a turnkey budget covers. */
  interiors: boolean
}

export interface BoqSection {
  id: string
  title: string
  kind: 'building' | 'room'
  floorId?: string
  roomId?: string
  lines: BoqLine[]
  subtotal: number
}

export interface BoqEstimate {
  sections: BoqSection[]
  includeInteriors: boolean
  constructionItems: number
  /** Always calculated, so the UI can show what turnkey would add even when it's off. */
  interiorItems: number
  itemsTotal: number
  overheads: { id: string; label: string; pct: number; amount: number }[]
  total: number
  /** Floor area of every storey including walls, sq ft. */
  builtUpArea: number
  costPerSqft: number
  location: { factor: number; label: string }
  budget: { amount: number; difference: number; status: 'within' | 'close' | 'over' } | null
  ratesAsOf: string
}

export interface BoqInput {
  plot: Plot
  floors: Floor[]
  brief: ProjectBrief | null
  /** The customer's budget; `turnkey` sets whether interiors are included by default. */
  budget: { amount: number; turnkey: boolean } | null
  /** Overrides the budget's scope, e.g. to preview turnkey on a construction-only budget. */
  includeInteriors?: boolean
}

const CUFT_TO_CUM = 0.0283168
const MM_TO_FT = 1 / 304.8
/** Masonry stops under the beams. */
const BEAM_ALLOWANCE_FT = 1.25
const BATH_DADO_FT = 7
const KITCHEN_DADO_FT = 2
/** Over budget by up to this much counts as "close". */
const CLOSE_TO_BUDGET = 1.1

const FLOOR_RATE: Record<FloorFinish, RateKey> = {
  tile: 'floorTile',
  marble: 'floorMarble',
  wood: 'floorWood',
  carpet: 'floorCarpet',
  concrete: 'floorConcrete',
}

const ELEC_RATE: Partial<Record<ElecKind, RateKey>> = {
  light: 'elecLight',
  fan: 'elecFan',
  exhaust: 'elecExhaust',
  switchboard: 'elecSwitchboard',
  socket5: 'elecSocket',
  socket15: 'elecPowerSocket',
  ac: 'elecAc',
  geyser: 'elecGeyser',
  tv: 'elecTv',
  bell: 'elecBell',
}

const FIXTURE_RATE: Partial<Record<PlacedItem['kind'], RateKey>> = { wc: 'wc', basin: 'basin', shower: 'shower', sink: 'sink' }
const BUILT_IN_RATE: Partial<Record<PlacedItem['kind'], RateKey>> = {
  'tv-unit': 'tvUnit',
  study: 'studyUnit',
  'pooja-unit': 'poojaUnit',
  'shoe-rack': 'shoeRack',
  shelf: 'shelf',
}

/** Which room an internal door belongs to (the one it mostly serves), for the room-wise BOQ. */
const DOOR_OWNER_PRIORITY: RoomType[] = ['wet', 'bedroom', 'pooja', 'kitchen', 'utility', 'living', 'circulation']

const round2 = (n: number) => Math.round(n * 100) / 100
const sqftOf = (r: { width: number; height: number }) => r.width * r.height
const lengthOf = (item: { width: number; height: number }) => Math.max(item.width, item.height)
const openingArea = (o: PlanOpening) => o.width * o.height

class Builder {
  sections: BoqSection[] = []
  private factor: number

  constructor(factor: number) {
    this.factor = factor
  }

  section(section: Omit<BoqSection, 'lines' | 'subtotal'>) {
    const s: BoqSection = { ...section, lines: [], subtotal: 0 }
    this.sections.push(s)
    return s
  }

  line(section: BoqSection, key: RateKey, quantity: number, options: { interiors?: boolean; description?: string } = {}) {
    const qty = round2(quantity)
    if (!(qty > 0)) return
    const { label, unit } = RATES[key]
    const rate = Math.round(RATES[key].rate * this.factor)
    section.lines.push({
      id: `${section.id}:${key}`,
      rateKey: key,
      description: options.description ?? label,
      quantity: qty,
      unit,
      rate,
      amount: Math.round(qty * rate),
      interiors: options.interiors ?? false,
    })
  }
}

/** Masonry or finish area of a wall: length × height, less its doors and windows. */
function netWallArea(wall: WallSegment, height: number, openings: PlanOpening[]) {
  const deductions = openings.filter((o) => o.wall.id === wall.id).reduce((sum, o) => sum + openingArea(o), 0)
  return Math.max(0, wallLength(wall) * height - deductions)
}

function doorOwner(opening: PlanOpening, rooms: Map<string, PlanRoom>): string | undefined {
  if (opening.kind === 'main-door') return opening.roomIds[0]
  const candidates = opening.roomIds.map((id) => rooms.get(id)).filter((r) => r !== undefined)
  candidates.sort((a, b) => DOOR_OWNER_PRIORITY.indexOf(a.type) - DOOR_OWNER_PRIORITY.indexOf(b.type))
  return candidates[0]?.id
}

function buildingSections(b: Builder, models: FloorModel[], floors: Floor[], set: ReturnType<typeof buildDrawingSet>, front: ReturnType<typeof frontSide>) {
  const lowest = models[0]
  const columns = set.columns

  const sub = b.section({ id: 'foundation', title: 'Foundation & plinth', kind: 'building' })
  const footings = deriveFootings(columns)
  b.line(sub, 'excavation', footings.reduce((s, f) => s + (f.size + 1) ** 2 * f.depthBelowGL, 0) * CUFT_TO_CUM)
  b.line(sub, 'pcc', footings.reduce((s, f) => s + (f.size + 0.5) ** 2 * 100 * MM_TO_FT, 0) * CUFT_TO_CUM)
  b.line(
    sub,
    'rccFooting',
    footings.reduce((s, f) => s + f.size ** 2 * parseInt(FOOTING_TYPES[f.type].thickness, 10) * MM_TO_FT, 0) * CUFT_TO_CUM,
  )
  const plinthBeams = deriveBeams(lowest.walls, columns)
  b.line(sub, 'rccBeam', plinthBeams.reduce((s, beam) => s + beam.span * beam.widthMm * beam.depthMm * MM_TO_FT ** 2, 0) * CUFT_TO_CUM, {
    description: 'RCC M20 plinth beams, incl. steel and formwork',
  })
  b.line(sub, 'plinthFilling', lowest.rooms.reduce((s, r) => s + sqftOf(r), 0))

  const frame = b.section({ id: 'structure', title: 'Structure: columns, beams, slabs, stairs', kind: 'building' })
  let columnCum = 0
  let beamCum = 0
  let slabCum = 0
  for (const model of models) {
    if (model.rooms.length === 0) continue
    const columnHeight = model.height + (model.isLowest ? (footings[0]?.depthBelowGL ?? 0) : 0)
    columnCum += columns.reduce((s, c) => s + c.width * c.depth * columnHeight, 0) * CUFT_TO_CUM
    beamCum += deriveBeams(model.walls, columns).reduce((s, beam) => s + beam.span * beam.widthMm * beam.depthMm * MM_TO_FT ** 2, 0) * CUFT_TO_CUM
    slabCum += deriveSlabs(model.rooms).reduce((s, slab) => s + slab.lx * slab.ly * slab.thicknessMm * MM_TO_FT, 0) * CUFT_TO_CUM
  }
  b.line(frame, 'rccColumn', columnCum)
  b.line(frame, 'rccBeam', beamCum, { description: 'RCC M20 floor and roof beams, incl. steel and formwork' })
  b.line(frame, 'rccSlab', slabCum)
  const risers = models
    .slice(0, -1)
    .filter((model, i) => model.rooms.length > 0 && models[i + 1].rooms.length > 0)
    .reduce((s, model) => s + designStair(floors, model.floor, model.height).risers, 0)
  b.line(frame, 'staircase', risers)

  const walls = b.section({ id: 'walls', title: 'Walls, external finish & roof', kind: 'building' })
  let outer = 0
  let partitions = 0
  let external = 0
  for (const model of models) {
    const masonryHeight = model.height - BEAM_ALLOWANCE_FT
    for (const wall of model.walls) {
      const area = netWallArea(wall, masonryHeight, model.openings)
      if (wall.exterior) {
        outer += area
        external += netWallArea(wall, model.height, model.openings)
      } else {
        partitions += area
      }
    }
  }
  b.line(walls, 'brick230', outer)
  b.line(walls, 'brick115', partitions)
  b.line(walls, 'plasterExternal', external)
  b.line(walls, 'paintExternal', external)
  // Each floor's roof is whatever the floor above doesn't cover.
  const floorArea = models.map((m) => m.rooms.reduce((s, r) => s + sqftOf(r), 0))
  b.line(walls, 'roofWaterproofing', floorArea.reduce((s, a, i) => s + Math.max(0, a - (floorArea[i + 1] ?? 0)), 0))

  const services = b.section({ id: 'services', title: 'Plumbing & electrical: common', kind: 'building' })
  let water = 0
  let drain = 0
  let chambers = 0
  let boards = 0
  const upperStacks = models.slice(1).flatMap((m) => drainagePlan(m, set.items.get(m.floor.id) ?? [], [], front).stacks)
  for (const model of models) {
    const items = set.items.get(model.floor.id) ?? []
    water += waterSupplyPlan(model, items).runs.reduce((s, run) => s + pathLength(run.points), 0)
    const drainage = drainagePlan(model, items, model.isLowest ? upperStacks : [], front)
    drain += drainage.runs.reduce((s, run) => s + pathLength(run.points), 0)
    chambers += drainage.chambers.length
    boards += electricalPlan(model, items).points.filter((p) => p.kind === 'db').length
  }
  b.line(services, 'waterPipes', water)
  b.line(services, 'drainPipes', drain)
  b.line(services, 'chambers', chambers)
  if (models.some((m) => m.rooms.some((r) => r.type === 'wet' || r.type === 'kitchen'))) b.line(services, 'waterTank', 1)
  b.line(services, 'distributionBoard', boards)
  if (models.some((m) => m.rooms.length > 0)) b.line(services, 'earthing', 1)
}

function roomSections(b: Builder, models: FloorModel[], set: ReturnType<typeof buildDrawingSet>) {
  for (const model of models) {
    const rooms = new Map(model.rooms.map((r) => [r.id, r]))
    const items = set.items.get(model.floor.id) ?? []
    const points = electricalPlan(model, items).points
    const ceilings = ceilingPlan(model)
    const clearHeight = model.height - SLAB_THICKNESS
    const multiFloor = models.length > 1

    for (const room of model.rooms) {
      const section = b.section({
        id: `room-${room.id}`,
        title: multiFloor ? `${room.name} · ${model.floor.name}` : room.name,
        kind: 'room',
        floorId: model.floor.id,
        roomId: room.id,
      })
      const area = sqftOf(room)
      const perimeter = 2 * (room.width + room.height)
      const openings = model.openings.filter((o) => o.roomIds.includes(room.id))
      const openingsArea = openings.reduce((s, o) => s + openingArea(o), 0)
      const roomItems = items.filter((i) => i.roomId === room.id)
      const counterLength = roomItems.filter((i) => i.kind === 'counter').reduce((s, i) => s + lengthOf(i), 0)

      let dado = 0
      if (room.type === 'wet') dado = Math.max(0, perimeter * Math.min(BATH_DADO_FT, clearHeight) - openingsArea)
      else if (room.type === 'kitchen') dado = counterLength * KITCHEN_DADO_FT
      const plaster = Math.max(0, perimeter * clearHeight - openingsArea - dado)

      b.line(section, FLOOR_RATE[room.room.floorFinish], area, { description: RATES[FLOOR_RATE[room.room.floorFinish]].label })
      b.line(section, 'dadoTiles', dado)
      b.line(section, 'plasterInternal', plaster)
      b.line(section, 'paintInternal', plaster)
      b.line(section, 'ceilingFinish', area)
      if (room.type === 'wet') b.line(section, 'wetWaterproofing', area)

      const doors = model.openings.filter((o) => isDoor(o) && doorOwner(o, rooms) === room.id)
      b.line(section, 'mainDoor', doors.filter((o) => o.kind === 'main-door').length)
      const internal = doors.filter((o) => o.kind !== 'main-door')
      const intoWet = internal.filter((o) => o.roomIds.some((id) => rooms.get(id)?.type === 'wet')).length
      b.line(section, 'bathroomDoor', intoWet)
      b.line(section, 'internalDoor', internal.length - intoWet)
      b.line(section, 'window', openings.filter((o) => o.kind === 'window').reduce((s, o) => s + openingArea(o), 0))
      b.line(section, 'ventilator', openings.filter((o) => o.kind === 'ventilator').length)

      const roomPoints = points.filter((p) => p.roomId === room.id)
      for (const [kind, key] of Object.entries(ELEC_RATE) as [ElecKind, RateKey][]) {
        b.line(section, key, roomPoints.filter((p) => p.kind === kind).length)
      }
      for (const [kind, key] of Object.entries(FIXTURE_RATE) as [PlacedItem['kind'], RateKey][]) {
        b.line(section, key, roomItems.filter((i) => i.kind === kind).length)
      }

      // Interiors: counted for every plan, included in the total only for turnkey.
      const interiors = { interiors: true }
      b.line(section, 'wardrobe', roomItems.filter((i) => i.kind === 'wardrobe').reduce((s, i) => s + lengthOf(i) * i.verticalHeight, 0), interiors)
      b.line(section, 'modularKitchen', counterLength, interiors)
      const ceiling = ceilings.find((c) => c.roomId === room.id)
      if (ceiling && ceiling.kind !== 'exposed') b.line(section, 'falseCeiling', area, interiors)
      b.line(section, 'lightFixture', roomPoints.filter((p) => p.kind === 'light').length, interiors)
      b.line(section, 'ceilingFan', roomPoints.filter((p) => p.kind === 'fan').length, interiors)
      b.line(section, 'exhaustFan', roomPoints.filter((p) => p.kind === 'exhaust').length, interiors)
      for (const [kind, key] of Object.entries(BUILT_IN_RATE) as [PlacedItem['kind'], RateKey][]) {
        b.line(section, key, roomItems.filter((i) => i.kind === kind).length, interiors)
      }
      if (room.type === 'wet') b.line(section, 'bathAccessories', 1, interiors)
    }
  }
}

/**
 * Room-wise bill of quantities and cost estimate (project document §7). Quantities come from the
 * same derived model as the drawing sheets (walls, openings, structure, services, interior
 * layout), priced from lib/boq/rates.ts. Loose furniture and appliances are not included.
 */
export function estimateBoq(input: BoqInput): BoqEstimate {
  const location = locationFactor(input.brief?.city)
  const includeInteriors = input.includeInteriors ?? input.budget?.turnkey ?? false
  const set = buildDrawingSet(input.plot, input.floors, '', '')
  const models = set.models
  const b = new Builder(location.factor)

  if (models.some((m) => m.rooms.length > 0)) {
    buildingSections(b, models, input.floors, set, frontSide(input.plot))
    roomSections(b, models, set)
  }

  const allLines = b.sections.flatMap((s) => s.lines)
  const constructionItems = allLines.filter((l) => !l.interiors).reduce((s, l) => s + l.amount, 0)
  const interiorItems = allLines.filter((l) => l.interiors).reduce((s, l) => s + l.amount, 0)
  const sections = b.sections
    .map((s) => {
      const lines = includeInteriors ? s.lines : s.lines.filter((l) => !l.interiors)
      return { ...s, lines, subtotal: lines.reduce((sum, l) => sum + l.amount, 0) }
    })
    .filter((s) => s.lines.length > 0)
  const itemsTotal = constructionItems + (includeInteriors ? interiorItems : 0)
  const overheads = OVERHEADS.map((o) => ({ ...o, amount: Math.round(itemsTotal * o.pct) }))
  const total = itemsTotal + overheads.reduce((s, o) => s + o.amount, 0)
  const builtUpArea = Math.round(models.reduce((s, m) => s + m.rooms.reduce((a, r) => a + sqftOf(r), 0) + wallsArea(m.walls), 0))

  let budget: BoqEstimate['budget'] = null
  if (input.budget && input.budget.amount > 0) {
    const difference = input.budget.amount - total
    budget = {
      amount: input.budget.amount,
      difference,
      status: total <= input.budget.amount ? 'within' : total <= input.budget.amount * CLOSE_TO_BUDGET ? 'close' : 'over',
    }
  }

  return {
    sections,
    includeInteriors,
    constructionItems,
    interiorItems,
    itemsTotal,
    overheads,
    total,
    builtUpArea,
    costPerSqft: builtUpArea > 0 ? Math.round(total / builtUpArea) : 0,
    location,
    budget,
    ratesAsOf: RATES_AS_OF,
  }
}

/** Indian short form: ₹48.6 L, ₹1.25 Cr. */
export function formatLakhs(amount: number) {
  const sign = amount < 0 ? '−' : ''
  const value = Math.abs(amount)
  if (value >= 1e7) return `${sign}₹${(value / 1e7).toFixed(2)} Cr`
  if (value >= 1e5) return `${sign}₹${(value / 1e5).toFixed(1)} L`
  return `${sign}₹${Math.round(value).toLocaleString('en-IN')}`
}

function csvCell(value: string | number) {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** The BOQ as CSV (opens in Excel), with a header block, every line, section subtotals and totals. */
export function boqToCsv(estimate: BoqEstimate, projectName: string) {
  const rows: (string | number)[][] = [
    ['Bill of Quantities', projectName],
    ['Scope', estimate.includeInteriors ? 'Turnkey (construction + interiors)' : 'Construction only'],
    ['Built-up area (sq ft)', estimate.builtUpArea],
    ['Location factor', `${estimate.location.label} × ${estimate.location.factor}`],
    ['Rates', estimate.ratesAsOf],
    [],
    ['Section', 'Item', 'Quantity', 'Unit', 'Rate (₹)', 'Amount (₹)'],
  ]
  for (const section of estimate.sections) {
    for (const line of section.lines) {
      rows.push([section.title, line.description, line.quantity, RATE_UNIT_TEXT[line.unit], line.rate, line.amount])
    }
    rows.push([section.title, 'Subtotal', '', '', '', section.subtotal])
  }
  rows.push([], ['', 'Items total', '', '', '', estimate.itemsTotal])
  for (const o of estimate.overheads) rows.push(['', `${o.label} (${Math.round(o.pct * 100)}%)`, '', '', '', o.amount])
  rows.push(['', 'Estimated total', '', '', '', estimate.total])
  if (estimate.budget) {
    rows.push(['', 'Budget', '', '', '', estimate.budget.amount])
    rows.push(['', estimate.budget.difference >= 0 ? 'Under budget by' : 'Over budget by', '', '', '', Math.abs(estimate.budget.difference)])
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

const RATE_UNIT_TEXT: Record<RateUnit, string> = { cum: 'cu m', sqft: 'sq ft', rft: 'rft', nos: 'nos', LS: 'LS' }
