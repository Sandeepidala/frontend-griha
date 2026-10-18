import { describe, expect, it } from 'vitest'
import { DEFAULT_BRIEF } from '@/lib/brief'
import { generateOptions } from '@/lib/generator'
import { STYLE_KITS, STYLE_ORDER, lookFor } from '@/lib/style/kits'
import type { DesignStyle } from '@/types/brief'
import type { Floor, Plot } from '@/types/design'
import { buildFacade } from './facade'
import { PLINTH_HEIGHT, buildBuildingModel, frontSide } from './geometry'

// A generated two-storey house on a north-facing plot with room in front for a sit-out.
const plot: Plot = { width: 30, height: 45, facing: 'north', units: 'ft', setbacks: { front: 9, rear: 2, left: 2, right: 2 } }
const brief = { ...DEFAULT_BRIEF, floors: 2, bedrooms: 3, bathrooms: 2 }

function house(): Floor[] {
  const result = generateOptions({ plot, brief, budget: { amount: 4_500_000, turnkey: false }, count: 1 })
  if (!result.ok) throw new Error(result.reason)
  return result.options[0].floors
}

const floors = house()
const models = buildBuildingModel(floors, plot)
const facadeFor = (style: DesignStyle, palette: string | null = null) => buildFacade(models, plot, lookFor({ style, palette }))
const roles = (style: DesignStyle) => new Set(facadeFor(style).solids.map((s) => s.role))
const takeoff = (style: DesignStyle) => Object.fromEntries(facadeFor(style).takeoff.map((t) => [t.key, t.quantity]))

describe('house styles', () => {
  it('builds every style on the same plan, with its walls in the chosen colour scheme', () => {
    for (const style of STYLE_ORDER) {
      for (const palette of STYLE_KITS[style].palettes) {
        const facade = facadeFor(style, palette.id)
        const walls = facade.solids.filter((s) => s.role === 'wall' && s.floorId === floors.find((f) => f.level === 0)!.id)
        expect(walls.length, style).toBeGreaterThan(0)
        expect(walls.every((s) => s.color === palette.wall), `${style} ${palette.id}`).toBe(true)
        expect(facade.solids.find((s) => s.role === 'plinth')).toMatchObject({ z0: 0, z1: PLINTH_HEIGHT, color: palette.base })
        expect(facade.solids.every((s) => s.z1 > s.z0 && s.rect.width > 0 && s.rect.height > 0), style).toBe(true)
      }
    }
  })

  it('falls back to the first colour scheme, and to Modern without a brief', () => {
    expect(lookFor({ style: 'kerala', palette: 'no-such-scheme' }).palette.id).toBe('white-laterite')
    expect(lookFor(null).kit.id).toBe('modern')
  })

  it('gives Kerala a steep hip roof over deep eaves, tiled eaves between floors and a pillared sit-out', () => {
    const facade = facadeFor('kerala')
    const roof = facade.solids.find((s) => s.role === 'roof')!
    expect(roof.shape?.kind).toBe('slope')
    const top = models[models.length - 1].footprint!
    expect(roof.rect.width).toBeCloseTo(top.width + 5)
    // 0.75 rise per foot of run, up from the top slab.
    expect(roof.z1 - roof.z0).toBeCloseTo(0.75 * (Math.min(roof.rect.width, roof.rect.height) / 2))
    expect(facade.solids.some((s) => s.role === 'parapet')).toBe(false)
    expect(facade.solids.filter((s) => s.role === 'shade' && s.shape?.kind === 'slope').length).toBeGreaterThan(3)
    const pillars = facade.solids.filter((s) => s.role === 'pillar' && s.shape?.kind === 'cylinder')
    expect(pillars.length).toBe(2)
    expect(takeoff('kerala')).toMatchObject({ pillarWood: 2 })
    expect(takeoff('kerala').tileRoof).toBeGreaterThan(top.width * top.height)
  })

  it('gives Rajasthani jharokhas on the front, a notched parapet, a chhatri and a sandstone base', () => {
    const facade = facadeFor('rajasthani')
    expect(takeoff('rajasthani').jharokha).toBeGreaterThan(0)
    expect(takeoff('rajasthani').chhatri).toBe(1)
    expect(facade.solids.some((s) => s.role === 'dome' && s.shape?.kind === 'dome')).toBe(true)
    // Merlons stand above the parapet body.
    const parapets = facade.solids.filter((s) => s.role === 'parapet')
    expect(new Set(parapets.map((p) => Math.round((p.z1 - p.z0) * 10))).size).toBeGreaterThan(1)
    expect(takeoff('rajasthani').stoneCladding).toBeGreaterThan(0)
    // Jharokhas only on the road side.
    const front = frontSide(plot)
    const jharokhas = facade.solids.filter((s) => s.role === 'jharokha')
    const fp = models[0].footprint!
    if (front === 'N') expect(jharokhas.every((s) => s.rect.y < fp.y + 0.5)).toBe(true)
  })

  it('gives Contemporary a second-colour upper volume, a glass railing, a pergola and wood panels', () => {
    const look = lookFor({ style: 'contemporary', palette: null })
    const facade = facadeFor('contemporary')
    const upper = floors.find((f) => f.level === 1)!
    expect(facade.solids.filter((s) => s.role === 'wall' && s.floorId === upper.id).every((s) => s.color === look.palette.wallAlt)).toBe(true)
    expect(facade.solids.some((s) => s.role === 'railing' && s.opacity)).toBe(true)
    expect(roles('contemporary').has('pergola')).toBe(true)
    expect(takeoff('contemporary')).toHaveProperty('woodCladding')
    expect(takeoff('contemporary')).toHaveProperty('glassRailing')
  })

  it('gives a Punjabi kothi a flat-roofed portico on square pillars, corner domes and brick panels', () => {
    const t = takeoff('punjabi')
    expect(t).toMatchObject({ pillarRcc: 2, dome: 4 })
    expect(t.porchSlab).toBeGreaterThan(0)
    expect(t.brickCladding).toBeGreaterThan(0)
  })

  it('keeps Modern to a slim parapet, bands and RCC sunshades, which every house has, so nothing extra to price', () => {
    const r = roles('modern')
    expect(r.has('roof')).toBe(false)
    expect(r.has('pillar')).toBe(false)
    expect(facadeFor('modern').solids.filter((s) => s.role === 'shade').length).toBeGreaterThan(0)
    expect(facadeFor('modern').takeoff).toEqual([])
  })

  it('leaves out the sit-out when there is no room for it in front', () => {
    const tight: Plot = { ...plot, height: 34, setbacks: { front: 2, rear: 2, left: 2, right: 2 } }
    const result = generateOptions({ plot: tight, brief, budget: { amount: 4_500_000, turnkey: false }, count: 1 })
    if (!result.ok) throw new Error(result.reason)
    const tightModels = buildBuildingModel(result.options[0].floors, tight)
    const facade = buildFacade(tightModels, tight, lookFor({ style: 'kerala', palette: null }))
    expect(facade.solids.some((s) => s.role === 'pillar')).toBe(false)
  })
})
