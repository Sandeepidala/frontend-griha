import type { ProjectBrief } from '@/types/brief'
import type { Floor, Plot } from '@/types/design'
import { type FloorModel, buildBuildingModel, sortFloors } from './geometry'
import { type PlacedItem, layoutFloor } from './interior'
import { type Column, deriveColumns } from './services'

export type DisciplineId = 'general' | 'site' | 'architectural' | 'structural' | 'electrical' | 'plumbing' | 'interior' | 'model'

export type SheetKind =
  | 'summary'
  | 'estimate'
  | 'site-layout'
  | 'setbacks'
  | 'landscaping'
  | 'floor-plan'
  | 'roof-plan'
  | 'elevations'
  | 'sections'
  | 'foundation'
  | 'columns'
  | 'beams'
  | 'slabs'
  | 'staircase'
  | 'lighting'
  | 'power'
  | 'electrical-layout'
  | 'water-supply'
  | 'drainage'
  | 'sanitary'
  | 'furniture'
  | 'kitchen'
  | 'false-ceiling'
  | 'model-exterior'
  | 'model-interior'
  | 'model-landscape'

export interface Discipline {
  id: DisciplineId
  number: string
  name: string
}

export interface SheetDef {
  id: string
  kind: SheetKind
  discipline: DisciplineId
  code: string
  title: string
  /** Fixed floor for per-floor plans; null means the sheet follows the active floor (if `perFloor`). */
  floorId: string | null
  perFloor: boolean
  is3d: boolean
}

export const DISCIPLINES: Discipline[] = [
  { id: 'general', number: '00', name: 'General' },
  { id: 'site', number: '01', name: 'Site Plan' },
  { id: 'architectural', number: '02', name: 'Architectural' },
  { id: 'structural', number: '03', name: 'Structural' },
  { id: 'electrical', number: '04', name: 'Electrical' },
  { id: 'plumbing', number: '05', name: 'Plumbing' },
  { id: 'interior', number: '06', name: 'Interior' },
  { id: 'model', number: '07', name: '3D Model' },
]

function sheet(
  discipline: DisciplineId,
  kind: SheetKind,
  code: string,
  title: string,
  options: Partial<Pick<SheetDef, 'floorId' | 'perFloor' | 'is3d'>> = {},
): SheetDef {
  return {
    id: options.floorId ? `${kind}:${options.floorId}` : kind,
    kind,
    discipline,
    code,
    title,
    floorId: options.floorId ?? null,
    perFloor: options.perFloor ?? false,
    is3d: options.is3d ?? false,
  }
}

/** The drawing register: every sheet in the set, grouped by discipline in issue order. */
export function sheetRegister(floors: Floor[]): SheetDef[] {
  const plans = sortFloors(floors).map((floor, i) =>
    sheet('architectural', 'floor-plan', `A-${101 + i}`, `${floor.name} Plan`, { floorId: floor.id }),
  )
  return [
    sheet('general', 'summary', 'G-001', 'Project Summary'),
    sheet('general', 'estimate', 'G-002', 'Cost Estimate', { perFloor: true }),
    sheet('site', 'site-layout', 'SP-01', 'Site Layout'),
    sheet('site', 'setbacks', 'SP-02', 'Setbacks'),
    sheet('site', 'landscaping', 'SP-03', 'Landscaping'),
    ...plans,
    sheet('architectural', 'roof-plan', 'A-201', 'Roof Plan'),
    sheet('architectural', 'elevations', 'A-301', 'Elevations'),
    sheet('architectural', 'sections', 'A-401', 'Sections'),
    sheet('structural', 'foundation', 'S-101', 'Foundation'),
    sheet('structural', 'columns', 'S-102', 'Column Layout'),
    sheet('structural', 'beams', 'S-103', 'Beam Layout', { perFloor: true }),
    sheet('structural', 'slabs', 'S-104', 'Slab Layout', { perFloor: true }),
    sheet('structural', 'staircase', 'S-105', 'Staircase'),
    sheet('electrical', 'lighting', 'E-101', 'Lighting', { perFloor: true }),
    sheet('electrical', 'power', 'E-102', 'Power', { perFloor: true }),
    sheet('electrical', 'electrical-layout', 'E-103', 'Electrical Layout', { perFloor: true }),
    sheet('plumbing', 'water-supply', 'P-101', 'Water Supply', { perFloor: true }),
    sheet('plumbing', 'drainage', 'P-102', 'Drainage', { perFloor: true }),
    sheet('plumbing', 'sanitary', 'P-103', 'Sanitary'),
    sheet('interior', 'furniture', 'I-101', 'Furniture', { perFloor: true }),
    sheet('interior', 'kitchen', 'I-102', 'Kitchen'),
    sheet('interior', 'false-ceiling', 'I-103', 'False Ceiling', { perFloor: true }),
    sheet('model', 'model-exterior', 'M-101', 'Exterior', { is3d: true }),
    sheet('model', 'model-interior', 'M-102', 'Interior', { is3d: true, perFloor: true }),
    sheet('model', 'model-landscape', 'M-103', 'Landscape', { is3d: true }),
  ]
}

/** Everything a sheet needs, derived once from the design store. */
export interface DrawingSet {
  plot: Plot
  models: FloorModel[]
  items: Map<string, PlacedItem[]>
  /** Continuous column grid, derived from the lowest floor's walls. */
  columns: Column[]
  projectName: string
  author: string
  date: string
  /** The customer's brief and budget, for the summary and cost sheets. */
  brief: ProjectBrief | null
  budget: { amount: number; turnkey: boolean } | null
}

export function buildDrawingSet(
  plot: Plot,
  floors: Floor[],
  projectName: string,
  author: string,
  project: { brief?: ProjectBrief | null; budget?: { amount: number; turnkey: boolean } | null } = {},
): DrawingSet {
  const models = buildBuildingModel(floors, plot)
  const items = new Map(models.map((m) => [m.floor.id, layoutFloor(m)]))
  return {
    plot,
    models,
    items,
    columns: models[0] ? deriveColumns(models[0].walls) : [],
    projectName,
    author,
    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    brief: project.brief ?? null,
    budget: project.budget ?? null,
  }
}

export function modelFor(set: DrawingSet, floorId: string): FloorModel {
  return set.models.find((m) => m.floor.id === floorId) ?? set.models[0]
}
