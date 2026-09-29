import type { ReactNode } from 'react'
import type { Rect } from '@/lib/drawings/geometry'

/**
 * Drawing sheets are paper documents: fixed A3-landscape geometry in millimetres and a fixed
 * ink palette (independent of the app theme) so on-screen, SVG export and print all match.
 */

export const PAPER_W = 420
export const PAPER_H = 297
const BORDER = { x: 20, y: 10, width: 390, height: 277 }
const TITLE_W = 78
const TITLE_X = BORDER.x + BORDER.width - TITLE_W
const PAD = 9

export const FONT = 'Arial, Helvetica, sans-serif'

export const INK = {
  paper: '#ffffff',
  line: '#1d1d1f',
  mid: '#55555a',
  faint: '#9c9ca3',
  hair: '#d4d4d8',
  poche: '#3f3f46',
  hatch: '#a1a1aa',
  tint: '#f4f4f5',
  red: '#c62828',
  redSoft: '#fdecea',
  cold: '#1565c0',
  coldSoft: '#e3f0fd',
  hot: '#d84315',
  soil: '#6d4c41',
  waste: '#a1887f',
  elec: '#e65100',
  elecSoft: '#fff3e0',
  green: '#2e7d32',
  greenSoft: '#dcefd9',
  greenMid: '#81c784',
  paving: '#e7e1d6',
  road: '#d6d6d9',
  gold: '#b7791f',
} as const

const SCALES = [10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000]
const MM_PER_FT = 304.8

export interface SheetMeta {
  code: string
  title: string
  subtitle?: string
  disciplineNo: string
  discipline: string
  projectName: string
  author: string
  date: string
  /** Shown in the title block — used for "indicative, verify by engineer" disclaimers. */
  note?: string
}

export interface DrawCtx {
  /** Paper millimetres per foot at the sheet scale. */
  k: number
  /** Converts a paper size in millimetres into drawing feet — for text sizes and line weights. */
  mm: (value: number) => number
  scale: number
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

interface SheetFrameProps {
  meta: SheetMeta
  /** Extents of the drawing content, in feet. */
  bounds: Rect
  /** Optional panel inside the drawing area for schedules, tables and legends (mm wide). */
  aside?: { width: number; render: (box: Box) => ReactNode }
  /** Legend/notes content for the title column above the title block. */
  side?: (box: Box) => ReactNode
  northArrow?: boolean
  /** Paper-space overlays drawn above everything (captions etc). */
  overlay?: (ctx: DrawCtx, toPaper: (x: number, y: number) => { x: number; y: number }) => ReactNode
  children: (ctx: DrawCtx) => ReactNode
}

function pickScale(bounds: Rect, width: number, height: number) {
  const need = Math.max((bounds.width * MM_PER_FT) / width, (bounds.height * MM_PER_FT) / height)
  return SCALES.find((s) => s >= need) ?? Math.ceil(need / 100) * 100
}

export function SheetFrame({ meta, bounds, aside, side, northArrow, overlay, children }: SheetFrameProps) {
  const asideWidth = aside?.width ?? 0
  const area = {
    x: BORDER.x + PAD,
    y: BORDER.y + PAD + 4,
    width: TITLE_X - BORDER.x - PAD * 2 - (asideWidth ? asideWidth + 4 : 0),
    height: BORDER.height - PAD * 2 - 14,
  }
  const scale = pickScale(bounds, area.width, area.height)
  const k = MM_PER_FT / scale
  const tx = area.x + area.width / 2 - (bounds.x + bounds.width / 2) * k
  const ty = area.y + area.height / 2 - (bounds.y + bounds.height / 2) * k
  const ctx: DrawCtx = { k, mm: (v) => v / k, scale }
  const toPaper = (x: number, y: number) => ({ x: tx + x * k, y: ty + y * k })

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${PAPER_W} ${PAPER_H}`}
      width={`${PAPER_W}mm`}
      height={`${PAPER_H}mm`}
      fontFamily={FONT}
      style={{ background: INK.paper }}
    >
      <PatternDefs mm={(v) => v} prefix="p-" />
      <rect x={0} y={0} width={PAPER_W} height={PAPER_H} fill={INK.paper} />
      <rect {...BORDER} fill="none" stroke={INK.line} strokeWidth={0.7} />
      <rect x={BORDER.x - 1.5} y={BORDER.y - 1.5} width={BORDER.width + 3} height={BORDER.height + 3} fill="none" stroke={INK.line} strokeWidth={0.2} />

      <g transform={`translate(${tx} ${ty}) scale(${k})`}>
        <PatternDefs mm={ctx.mm} prefix="" />
        {children(ctx)}
      </g>

      {overlay?.(ctx, toPaper)}

      {/* Sheet caption under the drawing */}
      <g transform={`translate(${BORDER.x + PAD} ${BORDER.y + BORDER.height - PAD})`}>
        <ScaleBar k={k} />
        <text x={Math.max(70, scaleStep(k) * k * 4 + 12)} y={0} fontSize={4.2} fontWeight={700} fill={INK.line}>
          {meta.title.toUpperCase()}
          {meta.subtitle ? ` — ${meta.subtitle.toUpperCase()}` : ''}
        </text>
        <text x={Math.max(70, scaleStep(k) * k * 4 + 12)} y={4.2} fontSize={2.6} fill={INK.mid}>
          SCALE 1:{scale} (A3) · ALL DIMENSIONS IN FEET-INCHES UNLESS NOTED
        </text>
      </g>

      {northArrow && <NorthArrow x={BORDER.x + PAD + 8} y={BORDER.y + PAD + 10} />}

      {aside && (
        <g>
          <line
            x1={TITLE_X - PAD - asideWidth}
            x2={TITLE_X - PAD - asideWidth}
            y1={BORDER.y + 4}
            y2={BORDER.y + BORDER.height - PAD - 8}
            stroke={INK.hair}
            strokeWidth={0.3}
          />
          {aside.render({
            x: TITLE_X - PAD - asideWidth + 4,
            y: BORDER.y + PAD,
            width: asideWidth - 2,
            height: BORDER.height - PAD * 2,
          })}
        </g>
      )}

      <TitleColumn meta={meta} scale={scale} side={side} />
    </svg>
  )
}

/**
 * Hatch patterns sized in paper millimetres. Patterns resolve in the referencing element's user
 * space, so drawing content (feet) uses the plain ids and paper-space legends use `p-` ids.
 */
function PatternDefs({ mm, prefix }: { mm: (v: number) => number; prefix: string }) {
  const n = (v: number) => mm(v)
  return (
    <defs>
      <pattern id={`${prefix}hatch-diag`} patternUnits="userSpaceOnUse" width={n(1.6)} height={n(1.6)} patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={n(1.6)} stroke={INK.hatch} strokeWidth={n(0.25)} />
      </pattern>
      <pattern id={`${prefix}hatch-earth`} patternUnits="userSpaceOnUse" width={n(2.4)} height={n(2.4)} patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={n(2.4)} stroke={INK.soil} strokeWidth={n(0.2)} />
        <line x1={n(1.2)} y1={0} x2={n(1.2)} y2={n(1)} stroke={INK.soil} strokeWidth={n(0.2)} />
      </pattern>
      <pattern id={`${prefix}hatch-lawn`} patternUnits="userSpaceOnUse" width={n(2.2)} height={n(2.2)}>
        <rect width={n(2.2)} height={n(2.2)} fill={INK.greenSoft} />
        <path
          d={`M${n(0.5)} ${n(1.6)} l${n(0.3)} ${n(-0.7)} l${n(0.3)} ${n(0.7)} M${n(1.5)} ${n(0.8)} l${n(0.25)} ${n(-0.55)} l${n(0.25)} ${n(0.55)}`}
          stroke={INK.green}
          strokeWidth={n(0.12)}
          fill="none"
        />
      </pattern>
      <pattern id={`${prefix}hatch-paving`} patternUnits="userSpaceOnUse" width={n(2.4)} height={n(1.2)}>
        <rect width={n(2.4)} height={n(1.2)} fill={INK.paving} />
        <path d={`M0 0 H${n(2.4)} M0 0 V${n(0.6)} M${n(1.2)} ${n(0.6)} V${n(1.2)} M0 ${n(0.6)} H${n(2.4)}`} stroke={INK.hatch} strokeWidth={n(0.1)} fill="none" />
      </pattern>
      <pattern id={`${prefix}hatch-concrete`} patternUnits="userSpaceOnUse" width={n(3)} height={n(3)}>
        <rect width={n(3)} height={n(3)} fill="#ececee" />
        <circle cx={n(0.6)} cy={n(0.8)} r={n(0.12)} fill={INK.faint} />
        <circle cx={n(2.1)} cy={n(1.9)} r={n(0.15)} fill={INK.faint} />
        <circle cx={n(1.5)} cy={n(0.5)} r={n(0.1)} fill={INK.faint} />
      </pattern>
    </defs>
  )
}

function scaleStep(k: number) {
  return [1, 2, 5, 10, 20, 50, 100].find((s) => s * k >= 9) ?? 100
}

function ScaleBar({ k }: { k: number }) {
  const step = scaleStep(k)
  const w = step * k
  return (
    <g>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * w} y={-3} width={w} height={1.6} fill={i % 2 ? INK.paper : INK.line} stroke={INK.line} strokeWidth={0.2} />
      ))}
      {[0, 1, 2, 4].map((i) => (
        <text key={i} x={i * w} y={1.8} fontSize={2} textAnchor="middle" fill={INK.mid}>
          {i * step}
        </text>
      ))}
      <text x={4 * w + 2} y={-1.4} fontSize={2} fill={INK.mid}>
        FT
      </text>
    </g>
  )
}

export function NorthArrow({ x, y, size = 7 }: { x: number; y: number; size?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={size} fill="none" stroke={INK.line} strokeWidth={0.3} />
      <path d={`M0 ${-size + 1} L${size * 0.38} ${size * 0.55} L0 ${size * 0.25} Z`} fill={INK.line} />
      <path d={`M0 ${-size + 1} L${-size * 0.38} ${size * 0.55} L0 ${size * 0.25} Z`} fill={INK.paper} stroke={INK.line} strokeWidth={0.25} />
      <text y={-size - 1.5} fontSize={3.6} fontWeight={700} textAnchor="middle" fill={INK.line}>
        N
      </text>
    </g>
  )
}

function TitleColumn({ meta, scale, side }: { meta: SheetMeta; scale: number; side?: SheetFrameProps['side'] }) {
  const x = TITLE_X
  const w = TITLE_W
  const blockH = 96
  const blockY = BORDER.y + BORDER.height - blockH
  const row = (y: number, label: string, value: string, size = 3) => (
    <g>
      <text x={x + 3} y={y} fontSize={1.9} fill={INK.faint} letterSpacing={0.2}>
        {label}
      </text>
      <text x={x + 3} y={y + 4} fontSize={size} fill={INK.line} fontWeight={600}>
        {value}
      </text>
    </g>
  )
  const noteLines = meta.note ? wrapText(meta.note, 50) : []

  return (
    <g>
      <line x1={x} x2={x} y1={BORDER.y} y2={BORDER.y + BORDER.height} stroke={INK.line} strokeWidth={0.5} />
      <rect x={x} y={BORDER.y} width={w} height={11} fill={INK.line} />
      <text x={x + 3} y={BORDER.y + 7.3} fontSize={3.6} fontWeight={700} fill={INK.paper} letterSpacing={0.3}>
        {meta.disciplineNo} · {meta.discipline.toUpperCase()}
      </text>

      {side?.({ x: x + 3, y: BORDER.y + 16, width: w - 6, height: blockY - BORDER.y - 20 })}

      <line x1={x} x2={x + w} y1={blockY} y2={blockY} stroke={INK.line} strokeWidth={0.5} />
      <text x={x + 3} y={blockY + 7} fontSize={5} fontWeight={800} fill={INK.line} letterSpacing={0.4}>
        GRIHA
      </text>
      <text x={x + 26} y={blockY + 7} fontSize={2} fill={INK.mid}>
        RESIDENTIAL DESIGN STUDIO
      </text>
      <line x1={x} x2={x + w} y1={blockY + 10} y2={blockY + 10} stroke={INK.hair} strokeWidth={0.3} />
      {row(blockY + 15, 'PROJECT', truncate(meta.projectName, 34), 3.2)}
      {row(blockY + 25, 'DRAWING', truncate(meta.title + (meta.subtitle ? ` — ${meta.subtitle}` : ''), 34))}
      <line x1={x} x2={x + w} y1={blockY + 32} y2={blockY + 32} stroke={INK.hair} strokeWidth={0.3} />
      {row(blockY + 36.5, 'SCALE', `1:${scale} @ A3`, 2.8)}
      <g transform={`translate(${w / 2} 0)`}>{row(blockY + 36.5, 'DATE', meta.date, 2.8)}</g>
      {row(blockY + 46, 'DRAWN BY', truncate(meta.author, 18), 2.8)}
      <g transform={`translate(${w / 2} 0)`}>{row(blockY + 46, 'REVISION', 'R0 — FOR REVIEW', 2.8)}</g>
      <line x1={x} x2={x + w} y1={blockY + 53} y2={blockY + 53} stroke={INK.hair} strokeWidth={0.3} />
      {noteLines.map((line, i) => (
        <text key={i} x={x + 3} y={blockY + 57.5 + i * 2.8} fontSize={2} fill={INK.red}>
          {line}
        </text>
      ))}
      <rect x={x} y={blockY + 72} width={w} height={blockH - 72} fill={INK.tint} />
      <line x1={x} x2={x + w} y1={blockY + 72} y2={blockY + 72} stroke={INK.line} strokeWidth={0.5} />
      <text x={x + 3} y={blockY + 77} fontSize={1.9} fill={INK.faint} letterSpacing={0.2}>
        SHEET NO.
      </text>
      <text x={x + 3} y={blockY + 89} fontSize={10} fontWeight={800} fill={INK.line}>
        {meta.code}
      </text>
    </g>
  )
}

export function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = (current + ' ' + word).trim()
    }
  }
  if (current) lines.push(current)
  return lines
}

// ---------------------------------------------------------------------------------------------
// Paper-space blocks: legends, notes and schedules stacked into a box.
// ---------------------------------------------------------------------------------------------

export interface Block {
  height: number
  render: (x: number, y: number, width: number) => ReactNode
}

export function Stack({ box, blocks, gap = 5 }: { box: Box; blocks: Block[]; gap?: number }) {
  let y = box.y
  const out: ReactNode[] = []
  for (const [i, block] of blocks.entries()) {
    if (y + block.height > box.y + box.height + 0.5) break
    out.push(<g key={i}>{block.render(box.x, y, box.width)}</g>)
    y += block.height + gap
  }
  return <>{out}</>
}

function heading(x: number, y: number, text: string) {
  return (
    <text x={x} y={y + 3} fontSize={2.6} fontWeight={700} fill={INK.line} letterSpacing={0.3}>
      {text.toUpperCase()}
    </text>
  )
}

export interface LegendEntry {
  label: string
  /** Paper-space symbol drawn inside a 6×4 mm cell centred at (0,0). */
  symbol: ReactNode
}

export function legendBlock(title: string, entries: LegendEntry[]): Block {
  const rowH = 5.2
  return {
    height: 6 + entries.length * rowH,
    render: (x, y) => (
      <g>
        {heading(x, y, title)}
        {entries.map((entry, i) => (
          <g key={entry.label} transform={`translate(${x} ${y + 8 + i * rowH})`}>
            <g transform="translate(4 0)">{entry.symbol}</g>
            <text x={10} y={1} fontSize={2.3} fill={INK.line}>
              {entry.label}
            </text>
          </g>
        ))}
      </g>
    ),
  }
}

export function notesBlock(title: string, notes: string[], maxChars = 46): Block {
  const lines = notes.flatMap((note, i) => wrapText(`${i + 1}. ${note}`, maxChars).map((line, j) => ({ line, indent: j > 0 })))
  const lineH = 3
  return {
    height: 6 + lines.length * lineH,
    render: (x, y) => (
      <g>
        {heading(x, y, title)}
        {lines.map(({ line, indent }, i) => (
          <text key={i} x={x + (indent ? 3 : 0)} y={y + 8.5 + i * lineH} fontSize={2.1} fill={INK.mid}>
            {line}
          </text>
        ))}
      </g>
    ),
  }
}

export interface Column<Row> {
  title: string
  /** Fraction of the block width. */
  width: number
  align?: 'start' | 'end' | 'middle'
  value: (row: Row) => string
}

export function tableBlock<Row>(title: string, columns: Column<Row>[], rows: Row[], options: { footer?: string[]; fontSize?: number } = {}): Block {
  const rowH = 4
  const fontSize = options.fontSize ?? 2.1
  const body = options.footer ? [...rows.map((r) => columns.map((c) => c.value(r))), options.footer] : rows.map((r) => columns.map((c) => c.value(r)))
  return {
    height: 6 + rowH * (body.length + 1) + 1,
    render: (x, y, width) => {
      const xs: number[] = []
      let acc = 0
      for (const c of columns) {
        xs.push(acc * width)
        acc += c.width
      }
      const top = y + 6
      const maxChars = (i: number) => Math.max(3, Math.floor((columns[i].width * width) / (fontSize * 0.52)))
      return (
        <g>
          {heading(x, y, title)}
          <rect x={x} y={top} width={width} height={rowH} fill={INK.line} />
          {columns.map((c, i) => (
            <text
              key={c.title}
              x={x + xs[i] + (c.align === 'end' ? c.width * width - 1 : c.align === 'middle' ? (c.width * width) / 2 : 1)}
              y={top + rowH - 1.2}
              fontSize={fontSize - 0.1}
              fontWeight={700}
              fill={INK.paper}
              textAnchor={c.align ?? 'start'}
            >
              {c.title}
            </text>
          ))}
          {body.map((cells, r) => {
            const isFooter = options.footer && r === body.length - 1
            return (
              <g key={r}>
                <rect
                  x={x}
                  y={top + rowH * (r + 1)}
                  width={width}
                  height={rowH}
                  fill={isFooter ? INK.tint : r % 2 ? '#fafafa' : INK.paper}
                  stroke={INK.hair}
                  strokeWidth={0.15}
                />
                {cells.map((cell, i) => (
                  <text
                    key={i}
                    x={x + xs[i] + (columns[i].align === 'end' ? columns[i].width * width - 1 : columns[i].align === 'middle' ? (columns[i].width * width) / 2 : 1)}
                    y={top + rowH * (r + 2) - 1.2}
                    fontSize={fontSize}
                    fontWeight={isFooter ? 700 : 400}
                    fill={INK.line}
                    textAnchor={columns[i].align ?? 'start'}
                  >
                    {truncate(cell, maxChars(i))}
                  </text>
                ))}
              </g>
            )
          })}
        </g>
      )
    },
  }
}
