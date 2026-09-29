import type { FloorModel, Rect } from '@/lib/drawings/geometry'
import { type DrawingSet, type SheetDef, DISCIPLINES, modelFor } from '@/lib/drawings/sheets'
import { INK, type LegendEntry, type SheetMeta } from '../SheetFrame'

export interface SheetProps {
  set: DrawingSet
  sheet: SheetDef
  /** The active floor — used by sheets that follow the floor switcher. */
  floorId: string
}

export const ENGINEER_NOTE =
  'Indicative preliminary design generated from the plan. Verify and sign off by a licensed engineer before construction.'

export function sheetMeta(set: DrawingSet, sheet: SheetDef, options: { subtitle?: string; note?: string } = {}): SheetMeta {
  const discipline = DISCIPLINES.find((d) => d.id === sheet.discipline)!
  return {
    code: sheet.code,
    title: sheet.title,
    subtitle: options.subtitle,
    disciplineNo: discipline.number,
    discipline: discipline.name,
    projectName: set.projectName,
    author: set.author,
    date: set.date,
    note: options.note,
  }
}

/** The floor a sheet draws: fixed for per-floor plans, otherwise the active floor. */
export function sheetFloor(props: SheetProps): FloorModel {
  return modelFor(props.set, props.sheet.floorId ?? props.floorId)
}

export function padBounds(rect: Rect | null, pad: number, fallback: Rect): Rect {
  const r = rect ?? fallback
  return { x: r.x - pad, y: r.y - pad, width: r.width + pad * 2, height: r.height + pad * 2 }
}

export function EmptyNotice({ x, y, text, mm }: { x: number; y: number; text: string; mm: (v: number) => number }) {
  return (
    <text x={x} y={y} fontSize={mm(3)} textAnchor="middle" fill={INK.faint}>
      {text}
    </text>
  )
}

// Paper-space legend swatches (drawn in a 6×4mm cell centred on the origin).
export const swatch = {
  fill: (fill: string, stroke: string = INK.line): LegendEntry['symbol'] => (
    <rect x={-3} y={-2} width={6} height={4} fill={fill} stroke={stroke} strokeWidth={0.2} />
  ),
  line: (stroke: string, width = 0.4, dash?: string): LegendEntry['symbol'] => (
    <line x1={-3} x2={3} y1={0} y2={0} stroke={stroke} strokeWidth={width} strokeDasharray={dash} />
  ),
  pattern: (id: string): LegendEntry['symbol'] => (
    <rect x={-3} y={-2} width={6} height={4} fill={`url(#p-${id})`} stroke={INK.line} strokeWidth={0.2} />
  ),
}

export function fmtArea(sqft: number) {
  return `${Math.round(sqft).toLocaleString('en-IN')} sft`
}
