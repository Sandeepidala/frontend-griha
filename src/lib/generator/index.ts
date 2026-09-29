import { estimateBoq, type BoqEstimate } from '@/lib/boq'
import { compliantSetbacks, requirementsFor } from '@/lib/byelaws'
import { center, unionRect } from '@/lib/drawings/geometry'
import { runDesignCheck, type DesignReport } from '@/lib/designCheck'
import { ZONE_LABELS, zoneOf } from '@/lib/designCheck/context'
import type { ProjectBrief } from '@/types/brief'
import type { Floor, Plot, Room } from '@/types/design'
import { bandDepths, buildableEnvelope, footprintFor, layoutFloor, rebalance, toCompass, type Envelope, type LayoutVariant } from './layout'
import { CAR_LENGTH, CAR_WIDTH, PASSAGE_DEPTH, buildProgram, programAreaPerFloor, type Band, type ProgramVariant } from './program'

export interface GenerateInput {
  plot: Plot
  brief: ProjectBrief
  budget: { amount: number; turnkey: boolean } | null
  /** Same seed, same options; change it to explore other ones. */
  seed?: number
  /** How many options to return (default 4). */
  count?: number
}

export interface GeneratedOption {
  id: string
  label: string
  /** e.g. "Kitchen in the south-east · Master bedroom in the south-west". */
  summary: string
  floors: Floor[]
  report: DesignReport
  estimate: BoqEstimate
}

export type GenerateResult =
  | { ok: true; options: GeneratedOption[]; /** Caveats about the brief, e.g. more rooms than the plot comfortably holds. */ notes: string[] }
  | { ok: false; reason: string }

const CANDIDATES = 160
const COSTED = 12
const FLOOR_TO_FLOOR = 10

/** A small seeded PRNG (mulberry32), so the same brief and seed always give the same options. */
function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return h >>> 0
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]
}

function shuffler(seed: number) {
  return <T>(items: T[]): T[] => {
    const rng = random(seed + items.length * 7919)
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
}

interface Candidate {
  signature: string
  floors: Floor[]
  /** Parking and stairs big enough to use; candidates that aren't rank below those that are. */
  usable: boolean
}

/** Can a car (17 × 9 ft per car), a dog-leg staircase (about 7 × 10 ft) and every main room actually be used as placed? */
function usable(floors: Floor[], cars: number) {
  const fits = (r: Room | undefined, long: number, short: number) =>
    !!r && Math.max(r.width, r.height) >= long - 0.5 && Math.min(r.width, r.height) >= short - 0.5
  const ground = floors[0]?.rooms ?? []
  const parking = ground.find((r) => r.name === 'Parking')
  const parkingOk = cars === 0 || fits(parking, CAR_LENGTH, cars * CAR_WIDTH) || fits(parking, cars * CAR_LENGTH, CAR_WIDTH)
  const stairsOk = floors.length === 1 || floors.every((f) => fits(f.rooms.find((r) => r.name === 'Staircase'), 10, 7))
  // A living room or bedroom squeezed narrower than this can't be furnished, whatever its area.
  const roomsOk = floors.every((f) => f.rooms.every((r) => !['living', 'bedroom', 'kitchen'].includes(r.type) || Math.min(r.width, r.height) >= 7))
  return parkingOk && stairsOk && roomsOk
}

function buildCandidate(plot: Plot, brief: ProjectBrief, program: ProgramVariant, layout: LayoutVariant, env: Envelope, maxFootprint: number): Floor[] {
  const floorArea = env.length * env.depth
  const planned = buildProgram(brief, program, floorArea, layout.passage ? env.length * PASSAGE_DEPTH : 0)
  const frame = footprintFor(env, planned, layout.align, layout.passage, maxFootprint)
  const programs = planned.map((p) => rebalance(p, frame.length))
  const depths = bandDepths(programs, frame.depth, layout.passage)
  const suites = new Set(programs.flatMap((p) => p.rooms.filter((r) => r.attachedBath).map((r) => `gen-${p.level}-${r.key}`)))
  const floors = programs.map((floor): Floor => {
    const rooms: Room[] = layoutFloor(floor, frame, depths, layout)
      .filter((p) => p.rect.a >= 2 && p.rect.d >= 2)
      .map((p) => {
        const r = toCompass(p.rect, env, plot.facing)
        return {
          id: `gen-${floor.level}-${p.key}`,
          name: p.name,
          type: p.type,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          rotation: 0,
          wallHeight: 9,
          elevation: 0,
          color: null,
          floorFinish: p.finish,
          locked: false,
          visible: true,
          label: null,
          notes: '',
        }
      })
    return {
      id: `gen-floor-${floor.level}`,
      name: floor.name,
      level: floor.level,
      elevation: floor.level * FLOOR_TO_FLOOR,
      rooms,
      wallOverrides: {},
      openings: [],
      furniture: [],
      staircases: [],
      guides: { vertical: [], horizontal: [] },
    }
  })
  nameMasterLargest(floors, suites)
  return floors
}

/** Rooms come out in whatever sizes fit, so the master bedroom is whichever en-suite turned out largest. */
function nameMasterLargest(floors: Floor[], suites: Set<string>) {
  const bedrooms = floors.flatMap((f) => f.rooms).filter((r) => r.type === 'bedroom' && suites.has(r.id))
  const master = bedrooms.find((r) => r.name === 'Master Bedroom')
  const largest = bedrooms.reduce<Room | null>((best, r) => (!best || r.width * r.height > best.width * best.height ? r : best), null)
  if (master && largest && largest !== master && largest.width * largest.height > master.width * master.height) {
    ;[master.name, largest.name] = [largest.name, master.name]
  }
}

/** Share of each upper floor's rooms that sit over a ground-floor room (not over open ground). */
function supported(floors: Floor[]) {
  const ground = floors[0]?.rooms ?? []
  const overlap = (a: Room, b: Room) =>
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return floors.slice(1).every((floor) => {
    const area = floor.rooms.reduce((s, r) => s + r.width * r.height, 0)
    const covered = floor.rooms.reduce((s, r) => s + ground.reduce((t, g) => t + overlap(r, g), 0), 0)
    return area === 0 || covered / area >= 0.9
  })
}

/** A short description of where the key rooms ended up, for the option card. */
function summarise(floors: Floor[], plot: Plot) {
  const rooms = floors.flatMap((f) => f.rooms.map((r) => ({ ...r, floor: f.name })))
  const building = unionRect(rooms) ?? plot
  const where = (name: string) => {
    const room = rooms.find((r) => r.name === name)
    return room ? `${name} in the ${ZONE_LABELS[zoneOf(center(room), building)]}` : null
  }
  return [where('Kitchen'), where('Master Bedroom'), where('Quiet Room')].filter(Boolean).join(' · ')
}

/**
 * Generates floor plans from the brief (project document §7, §9.1): many variations of a
 * band layout (public rooms at the road side, service in the middle, bedrooms at the rear) are
 * scored with the design check, the best are costed, and the top distinct options are returned.
 */
export function generateOptions(input: GenerateInput): GenerateResult {
  const { brief, budget } = input
  // Plan to the bye-laws: at least the required setbacks, and no more ground coverage than allowed.
  const rules = requirementsFor(input.plot, brief)
  const plot: Plot = { ...input.plot, setbacks: compliantSetbacks(input.plot.setbacks, rules.setbacks) }
  // Outer walls add about 0.75 ft all round to the rooms' footprint.
  const maxFootprint = rules.maxCoverage * plot.width * plot.height * 0.9
  const env = buildableEnvelope(plot)
  if (!env) return { ok: false, reason: 'The plot is too small once the setbacks are taken off. Check the plot size and setbacks.' }

  const seed = input.seed ?? hash(JSON.stringify({ plot, brief }))
  const rng = random(seed)
  const kitchenBands: Band[] = ['middle', 'rear', 'front']

  const candidates: Candidate[] = []
  for (let i = 0; i < CANDIDATES; i++) {
    const program: ProgramVariant = {
      kitchenBand: pick(rng, kitchenBands),
      quietRoomBand: pick(rng, ['front', 'middle'] as const),
      // Cars nose-in from the road where the plot is deep enough; parallel only on shallow plots.
      parking: env.depth >= 42 || rng() < 0.5 ? 'perpendicular' : 'parallel',
    }
    const layout: LayoutVariant = {
      mirror: rng() < 0.5,
      stairEnd: rng() < 0.5 ? 'start' : 'end',
      parkingEnd: rng() < 0.5 ? 'start' : 'end',
      bathSide: rng() < 0.5 ? 'start' : 'end',
      passage: rng() < 0.8,
      align: pick(rng, ['start', 'center', 'end'] as const),
      shuffle: shuffler(Math.floor(rng() * 1e9)),
    }
    const floors = buildCandidate(plot, brief, program, layout, env, maxFootprint)
    // Upper-floor rooms need a ground-floor room under them (columns and walls to stand on).
    if (!supported(floors)) continue
    // Two variants that place every room identically are the same option.
    const signature = floors.map((f) => f.rooms.map((r) => `${r.name}@${r.x},${r.y},${r.width},${r.height}`).sort().join('|')).join('/')
    if (!candidates.some((c) => c.signature === signature)) candidates.push({ signature, floors, usable: usable(floors, brief.parkingCars) })
  }

  if (candidates.length === 0) {
    return { ok: false, reason: 'No workable layout fits this plot and brief. Try fewer rooms, another floor, or check the setbacks.' }
  }

  const notes: string[] = []
  const heightFt = brief.floors * FLOOR_TO_FLOOR
  if (heightFt > rules.maxHeightFt) {
    notes.push(
      `${brief.floors} floors make the house about ${heightFt} ft tall; the bye-laws (${rules.set.name}) allow ${rules.maxHeightFt} ft on a ${rules.roadWidthFt} ft road. Fewer floors, or a wider road if yours is, would comply.`,
    )
  }
  const needed = programAreaPerFloor(buildProgram(brief, { kitchenBand: 'middle', quietRoomBand: 'middle', parking: 'perpendicular' }, env.length * env.depth, 0))
  const buildable = env.length * env.depth
  if (needed > buildable * 1.05) {
    notes.push(
      `The brief needs about ${Math.round(needed)} sq ft on its busiest floor, but the plot allows about ${Math.round(buildable)} sq ft inside the setbacks, so some rooms come out smaller than standard. Another floor or fewer rooms would help.`,
    )
  }

  // Screen every candidate with the design check, then cost the most promising ones.
  const byQuality = <T extends Candidate & { report: DesignReport }>(a: T, b: T) => Number(b.usable) - Number(a.usable) || b.report.score - a.report.score
  const screened = candidates
    .map((c) => ({ ...c, report: runDesignCheck({ plot, floors: c.floors, brief }) }))
    .sort(byQuality)
    .slice(0, COSTED)
  const costed = screened
    .map((c) => {
      const estimate = estimateBoq({ plot, floors: c.floors, brief, budget })
      const cost = estimate.budget ? { estimate: estimate.total, budget: estimate.budget.amount, turnkey: estimate.includeInteriors } : null
      return { ...c, estimate, report: runDesignCheck({ plot, floors: c.floors, brief, cost }) }
    })
    .sort((a, b) => byQuality(a, b) || a.estimate.total - b.estimate.total)

  const count = input.count ?? 4
  const chosen: typeof costed = []
  for (const c of costed) {
    // Prefer options that differ in where the key rooms are, not just in small shifts.
    const summary = summarise(c.floors, plot)
    if (chosen.some((o) => summarise(o.floors, plot) === summary) && costed.length - costed.indexOf(c) > count - chosen.length) continue
    chosen.push(c)
    if (chosen.length === count) break
  }

  if (chosen.length > 0 && chosen.every((c) => c.report.results.some((r) => r.id === 'law-far' && r.status === 'fail'))) {
    notes.push(`Every option exceeds the floor area ratio allowed (${rules.far.toFixed(2)}); fewer or smaller rooms would bring it within the bye-laws.`)
  }
  if (chosen.some((c) => !c.usable)) {
    notes.push(
      brief.parkingCars > 0
        ? `A full-size parking bay for ${brief.parkingCars} car${brief.parkingCars > 1 ? 's' : ''} (17 ft long) or the staircase doesn't fit inside the setbacks in some options; consider stilt parking, fewer cars or a larger plot.`
        : 'The staircase doesn’t fit comfortably in some options; a larger plot or fewer rooms would help.',
    )
  }

  return {
    ok: true,
    notes,
    options: chosen.map((c, i) => ({
      id: `option-${seed}-${i}`,
      label: `Option ${String.fromCharCode(65 + i)}`,
      summary: summarise(c.floors, plot),
      floors: c.floors,
      report: c.report,
      estimate: c.estimate,
    })),
  }
}
