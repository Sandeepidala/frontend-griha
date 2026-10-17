import { describe, expect, it } from 'vitest'
import { estimateBoq } from '@/lib/boq'
import { DEFAULT_BRIEF } from '@/lib/brief'
import { generateOptions } from '@/lib/generator'
import type { Floor, Plot } from '@/types/design'
import { type BuildPiece, constructionSequence, pieceProgress, spentAt, stageAt, weekAt } from './construction'
import { buildBuildingModel } from './geometry'
import { type Box, buildingBoxes } from './massing'

const plot: Plot = { width: 30, height: 40, facing: 'north', units: 'ft', setbacks: { front: 3, rear: 2, left: 2, right: 2 } }
const brief = { ...DEFAULT_BRIEF, floors: 2, bedrooms: 3, bathrooms: 2 }
const budget = { amount: 4_500_000, turnkey: false }

function twoStoreyHouse(): Floor[] {
  const result = generateOptions({ plot, brief, budget, count: 1 })
  if (!result.ok) throw new Error(result.reason)
  return result.options[0].floors
}

const volume = (boxes: Box[]) => boxes.reduce((sum, b) => sum + b.rect.width * b.rect.height * (b.z1 - b.z0), 0)

describe('constructionSequence', () => {
  const floors = twoStoreyHouse()
  const estimate = estimateBoq({ plot, floors, brief, budget })
  const sequence = constructionSequence({ plot, floors, brief, estimate })
  const ids = sequence.stages.map((s) => s.id)
  const [ground, first] = [...floors].sort((a, b) => a.level - b.level)

  it('builds in site order: foundations, then each floor frame, walls and openings, then the parapet, finishing and outside', () => {
    expect(ids).toEqual([
      'site',
      'excavation',
      'footings',
      'plinth',
      `frame-${ground.id}`,
      `walls-${ground.id}`,
      `openings-${ground.id}`,
      `frame-${first.id}`,
      `walls-${first.id}`,
      `openings-${first.id}`,
      'parapet',
      'finishing',
      'outside',
    ])
  })

  it('runs the stages back to back, in the animation and in weeks on site', () => {
    sequence.stages.forEach((s, i) => {
      expect(s.end).toBeGreaterThan(s.start)
      expect(s.weekEnd).toBeGreaterThan(s.weekStart)
      if (i > 0) {
        expect(s.start).toBeCloseTo(sequence.stages[i - 1].end, 9)
        expect(s.weekStart).toBe(sequence.stages[i - 1].weekEnd)
      }
    })
    expect(sequence.duration).toBeGreaterThan(sequence.stages[sequence.stages.length - 1].end)
    expect(sequence.totalWeeks).toBe(sequence.stages[sequence.stages.length - 1].weekEnd)
    for (const piece of sequence.pieces) {
      expect(piece.end).toBeGreaterThan(piece.start)
      expect(piece.start).toBeGreaterThanOrEqual(0)
      expect(piece.end).toBeLessThanOrEqual(sequence.duration)
    }
  })

  it('puts up each floor’s structure before its brickwork, and the brickwork before its doors and windows', () => {
    const inStage = (id: string) => {
      const s = sequence.stages.find((st) => st.id === id)!
      return sequence.pieces.filter((p) => p.start >= s.start - 1e-9 && p.end <= s.end + 1e-9)
    }
    for (const floor of [ground, first]) {
      const frame = sequence.stages.find((s) => s.id === `frame-${floor.id}`)!
      const walls = inStage(`walls-${floor.id}`)
      expect(walls.length).toBeGreaterThan(0)
      expect(Math.min(...walls.map((p) => p.start))).toBeGreaterThanOrEqual(frame.end - 1e-9)
      expect(inStage(`openings-${floor.id}`).length).toBeGreaterThan(0)
    }
  })

  it('ends as the 3D model: the finished building, with the structure hidden in the walls and the pits backfilled', () => {
    const end = sequence.duration
    const shown = sequence.pieces.filter((p) => pieceProgress(p, end) === 1)
    expect(shown.some((p) => p.part === 'temporary')).toBe(false)
    const building = shown.filter((p) => p.part === 'building')
    const model = buildingBoxes(buildBuildingModel(floors, plot))
    expect(volume(building)).toBeCloseTo(volume(model), 6)
    expect(Math.max(...building.map((p) => p.z1))).toBeCloseTo(Math.max(...model.map((b) => b.z1)), 6)
    // The site works stay: the compound wall and gate.
    expect(shown.filter((p) => p.part === 'site').length).toBeGreaterThan(1)
  })

  it('raises the brickwork course by course: a wall’s lower pieces start first', () => {
    const walls = sequence.stages.find((s) => s.id === `walls-${ground.id}`)!
    const masonry = sequence.pieces.filter((p): p is BuildPiece => p.raw !== undefined && p.start >= walls.start && p.end <= walls.end + 1e-9)
    const low = masonry.filter((p) => p.z0 < 3)
    const high = masonry.filter((p) => p.z0 > 8)
    expect(low.length).toBeGreaterThan(0)
    expect(high.length).toBeGreaterThan(0)
    expect(Math.min(...high.map((p) => p.start))).toBeGreaterThan(Math.min(...low.map((p) => p.start)))
  })

  it('shares out the estimate across the stages, adding up to its total', () => {
    expect(sequence.totalCost).toBe(estimate.total)
    expect(sequence.stages[sequence.stages.length - 1].spent).toBe(estimate.total)
    expect(sequence.stages.every((s) => s.cost >= 0)).toBe(true)
    expect(sequence.stages.find((s) => s.id === `frame-${ground.id}`)!.cost).toBeGreaterThan(0)
    expect(spentAt(sequence, 0)).toBe(0)
    expect(spentAt(sequence, sequence.duration)).toBe(estimate.total)
    let previous = 0
    for (let t = 0; t <= sequence.duration; t += 0.25) {
      const spent = spentAt(sequence, t)
      expect(spent).toBeGreaterThanOrEqual(previous - 1e-6)
      previous = spent
    }
  })

  it('reports the stage and week under way', () => {
    expect(stageAt(sequence, 0)?.id).toBe('site')
    expect(stageAt(sequence, sequence.duration)?.id).toBe('outside')
    expect(weekAt(sequence, 0)).toBe(1)
    expect(weekAt(sequence, sequence.duration)).toBe(sequence.totalWeeks)
  })

  it('has no costs without an estimate, and only site work for an empty plan', () => {
    const unpriced = constructionSequence({ plot, floors, brief, estimate: null })
    expect(unpriced.totalCost).toBeNull()
    expect(unpriced.stages.every((s) => s.cost === 0)).toBe(true)

    const empty: Floor[] = [{ ...ground, rooms: [] }]
    const bare = constructionSequence({ plot, floors: empty, brief, estimate: null })
    expect(bare.pieces.some((p) => p.part === 'building')).toBe(false)
    expect(bare.stages.some((s) => s.id.startsWith('frame-'))).toBe(false)
  })
})
