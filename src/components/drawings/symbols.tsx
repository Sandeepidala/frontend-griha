import type { ReactNode } from 'react'
import {
  type FloorModel,
  type PlanOpening,
  type PlanRoom,
  type Point,
  type Rect,
  OUTWARD,
  area,
  formatFeet,
  wallCenterOffset,
  wallRect,
} from '@/lib/drawings/geometry'
import type { PlacedItem } from '@/lib/drawings/interior'
import type { ElecKind, PipeRun } from '@/lib/drawings/services'
import { INK } from './SheetFrame'

/** Drawing-space primitives. Coordinates are feet; `mm` converts paper millimetres to feet. */
type Mm = (value: number) => number

// ---------------------------------------------------------------------------------------------
// Plan base: walls, openings, room labels
// ---------------------------------------------------------------------------------------------

export interface PlanBaseProps {
  model: FloorModel
  mm: Mm
  /** Services drawings grey the architecture back so their own layer reads first. */
  muted?: boolean
  labels?: 'full' | 'name' | 'none'
  roomFill?: (room: PlanRoom) => string
  showOpenings?: boolean
}

function alongAcross(horizontal: boolean, along: number, across: number): Point {
  return horizontal ? { x: along, y: across } : { x: across, y: along }
}

function openingGap(o: PlanOpening): Rect {
  const r = wallRect(o.wall)
  const a0 = o.center - o.width / 2
  return o.wall.orientation === 'h'
    ? { x: a0, y: r.y - 0.02, width: o.width, height: r.height + 0.04 }
    : { x: r.x - 0.02, y: a0, width: r.width + 0.04, height: o.width }
}

export function OpeningSymbol({ opening: o, mm, muted }: { opening: PlanOpening; mm: Mm; muted?: boolean }) {
  const horizontal = o.wall.orientation === 'h'
  const t = o.wall.thickness
  const c = o.wall.at + wallCenterOffset(o.wall)
  const a0 = o.center - o.width / 2
  const a1 = o.center + o.width / 2
  const stroke = muted ? INK.faint : INK.line
  const P = (along: number, across: number) => alongAcross(horizontal, along, across)

  if (o.kind === 'door' || o.kind === 'main-door') {
    const dir = OUTWARD[o.swingSide ?? 'S']
    const s = horizontal ? dir.y : dir.x
    const face = c + (s * t) / 2
    const hinge = o.hingeAtStart ? a0 : a1
    const sign = o.hingeAtStart ? 1 : -1
    const open = P(hinge, face + s * o.width)
    const arc: string[] = []
    for (let i = 0; i <= 16; i++) {
      const phi = (i / 16) * (Math.PI / 2)
      const p = P(hinge + sign * o.width * Math.cos(phi), face + s * o.width * Math.sin(phi))
      arc.push(`${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`)
    }
    const h = P(hinge, face)
    return (
      <g>
        <path d={arc.join(' ')} fill="none" stroke={stroke} strokeWidth={mm(0.15)} strokeDasharray={`${mm(0.8)} ${mm(0.5)}`} />
        <line x1={h.x} y1={h.y} x2={open.x} y2={open.y} stroke={stroke} strokeWidth={mm(o.kind === 'main-door' ? 0.55 : 0.35)} />
        {[a0, a1].map((a) => {
          const p1 = P(a, c - t / 2)
          const p2 = P(a, c + t / 2)
          return <line key={a} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={mm(0.2)} />
        })}
      </g>
    )
  }

  const lines = o.kind === 'ventilator' ? [c - t / 4, c + t / 4] : [c - t / 2, c, c + t / 2]
  return (
    <g>
      {lines.map((across, i) => {
        const p1 = P(a0, across)
        const p2 = P(a1, across)
        return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={muted ? INK.faint : INK.cold} strokeWidth={mm(i === 1 && lines.length === 3 ? 0.18 : 0.25)} />
      })}
      {[a0, a1].map((a) => {
        const p1 = P(a, c - t / 2)
        const p2 = P(a, c + t / 2)
        return <line key={a} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={stroke} strokeWidth={mm(0.25)} />
      })}
    </g>
  )
}

export function PlanBase({ model, mm, muted, labels = 'full', roomFill, showOpenings = true }: PlanBaseProps) {
  const exterior = model.walls.filter((w) => w.exterior)
  const partitions = model.walls.filter((w) => !w.exterior)
  const wallFill = muted ? '#e4e4e7' : INK.poche
  const wallStroke = muted ? INK.faint : INK.line
  return (
    <g>
      {exterior.map((w) => (
        <rect key={w.id} {...wallRect(w)} fill={wallFill} stroke={wallStroke} strokeWidth={mm(0.12)} />
      ))}
      {model.rooms.map((room) => (
        <rect key={room.id} x={room.x} y={room.y} width={room.width} height={room.height} fill={roomFill?.(room) ?? INK.paper} />
      ))}
      {partitions.map((w) => (
        <rect key={w.id} {...wallRect(w)} fill={wallFill} stroke={wallStroke} strokeWidth={mm(0.1)} />
      ))}
      {showOpenings &&
        model.openings.map((o) => (
          <g key={o.id}>
            <rect {...openingGap(o)} fill={INK.paper} />
            <OpeningSymbol opening={o} mm={mm} muted={muted} />
          </g>
        ))}
      {labels !== 'none' && model.rooms.map((room) => <RoomLabel key={room.id} room={room} mm={mm} full={labels === 'full'} muted={muted} />)}
    </g>
  )
}

export function RoomLabel({ room, mm, full, muted, dy = 0 }: { room: PlanRoom; mm: Mm; full?: boolean; muted?: boolean; dy?: number }) {
  const widthMm = room.width / mm(1)
  const size = Math.max(1.5, Math.min(2.6, widthMm / (room.name.length * 0.62)))
  const cx = room.x + room.width / 2
  const cy = room.y + room.height / 2 + dy
  return (
    <g>
      <text x={cx} y={cy - (full ? mm(0.6) : -mm(size / 3))} fontSize={mm(size)} fontWeight={700} textAnchor="middle" fill={muted ? INK.faint : INK.line}>
        {room.name.toUpperCase()}
      </text>
      {full && (
        <text x={cx} y={cy + mm(2.6)} fontSize={mm(Math.min(1.9, size * 0.8))} textAnchor="middle" fill={INK.mid}>
          {formatFeet(room.width)} × {formatFeet(room.height)} · {Math.round(area(room))} sft
        </text>
      )}
    </g>
  )
}

// ---------------------------------------------------------------------------------------------
// Dimensions & annotation
// ---------------------------------------------------------------------------------------------

/**
 * A dimension chain along one axis: `stops` are coordinates along the axis, `at` is where the
 * dimension line sits across it.
 */
export function DimChain({ axis, stops, at, mm, color = INK.line }: { axis: 'x' | 'y'; stops: number[]; at: number; mm: Mm; color?: string }) {
  const sorted = [...new Set(stops.map((s) => Math.round(s * 100) / 100))].sort((a, b) => a - b)
  const P = (along: number, across: number) => (axis === 'x' ? { x: along, y: across } : { x: across, y: along })
  const tick = mm(1.2)
  const segments: ReactNode[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (b - a < 0.05) continue
    const mid = P((a + b) / 2, at - mm(1))
    const lengthMm = (b - a) / mm(1)
    const label = formatFeet(b - a)
    if (lengthMm < label.length * 1.1) continue
    segments.push(
      <text
        key={`t${i}`}
        x={mid.x}
        y={mid.y}
        fontSize={mm(1.9)}
        textAnchor="middle"
        fill={color}
        transform={axis === 'y' ? `rotate(-90 ${mid.x} ${mid.y})` : undefined}
      >
        {label}
      </text>,
    )
  }
  const p1 = P(sorted[0], at)
  const p2 = P(sorted[sorted.length - 1], at)
  return (
    <g>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={mm(0.18)} />
      {sorted.map((s) => {
        const c = P(s, at)
        const e1 = P(s, at - mm(1.8))
        const e2 = P(s, at + mm(1.8))
        return (
          <g key={s}>
            <line x1={e1.x} y1={e1.y} x2={e2.x} y2={e2.y} stroke={color} strokeWidth={mm(0.12)} />
            <line x1={c.x - tick / 2} y1={c.y + tick / 2} x2={c.x + tick / 2} y2={c.y - tick / 2} stroke={color} strokeWidth={mm(0.35)} />
          </g>
        )
      })}
      {segments}
    </g>
  )
}

/** Room-edge dimension chains on the north and west sides plus overall dimensions. */
export function PlanDimensions({ model, mm }: { model: FloorModel; mm: Mm }) {
  const fp = model.footprint
  if (!fp) return null
  const northRooms = model.rooms.filter((r) => Math.abs(r.y - (fp.y + 0.75)) < 0.1)
  const westRooms = model.rooms.filter((r) => Math.abs(r.x - (fp.x + 0.75)) < 0.1)
  const xs = northRooms.flatMap((r) => [r.x, r.x + r.width])
  const ys = westRooms.flatMap((r) => [r.y, r.y + r.height])
  return (
    <g>
      {xs.length > 0 && <DimChain axis="x" stops={xs} at={fp.y - mm(8)} mm={mm} />}
      <DimChain axis="x" stops={[fp.x, fp.x + fp.width]} at={fp.y - mm(15)} mm={mm} />
      {ys.length > 0 && <DimChain axis="y" stops={ys} at={fp.x - mm(8)} mm={mm} />}
      <DimChain axis="y" stops={[fp.y, fp.y + fp.height]} at={fp.x - mm(15)} mm={mm} />
    </g>
  )
}

export function Tag({
  x,
  y,
  text,
  mm,
  shape = 'circle',
  color = INK.line,
  fill = INK.paper,
  size = 2.2,
}: {
  x: number
  y: number
  text: string
  mm: Mm
  shape?: 'circle' | 'box' | 'diamond'
  color?: string
  fill?: string
  size?: number
}) {
  const r = mm(size)
  const w = Math.max(r * 2, mm(text.length * size * 0.55 + 1.2))
  return (
    <g>
      {shape === 'circle' && <circle cx={x} cy={y} r={Math.max(r, w / 2)} fill={fill} stroke={color} strokeWidth={mm(0.2)} />}
      {shape === 'box' && <rect x={x - w / 2} y={y - r * 0.8} width={w} height={r * 1.6} fill={fill} stroke={color} strokeWidth={mm(0.2)} />}
      {shape === 'diamond' && (
        <path d={`M${x} ${y - r * 1.2} L${x + w / 2 + r * 0.3} ${y} L${x} ${y + r * 1.2} L${x - w / 2 - r * 0.3} ${y} Z`} fill={fill} stroke={color} strokeWidth={mm(0.2)} />
      )}
      <text x={x} y={y + mm(size * 0.38)} fontSize={mm(size)} fontWeight={700} textAnchor="middle" fill={color}>
        {text}
      </text>
    </g>
  )
}

export function Label({ x, y, text, mm, size = 2, color = INK.mid, anchor = 'middle', weight = 400, rotate }: {
  x: number
  y: number
  text: string
  mm: Mm
  size?: number
  color?: string
  anchor?: 'start' | 'middle' | 'end'
  weight?: number
  rotate?: number
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={mm(size)}
      textAnchor={anchor}
      fontWeight={weight}
      fill={color}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
    >
      {text}
    </text>
  )
}

export function Polyline({ points, color, width, dash, mm, arrow }: { points: Point[]; color: string; width: number; dash?: number[]; mm: Mm; arrow?: boolean }) {
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
  const last = points[points.length - 1]
  const prev = points[points.length - 2]
  let head: ReactNode = null
  if (arrow && last && prev) {
    const ang = Math.atan2(last.y - prev.y, last.x - prev.x)
    const s = mm(1.4)
    const a1 = { x: last.x - s * Math.cos(ang - 0.45), y: last.y - s * Math.sin(ang - 0.45) }
    const a2 = { x: last.x - s * Math.cos(ang + 0.45), y: last.y - s * Math.sin(ang + 0.45) }
    head = <path d={`M${last.x} ${last.y} L${a1.x} ${a1.y} L${a2.x} ${a2.y} Z`} fill={color} />
  }
  return (
    <g>
      <path d={d} fill="none" stroke={color} strokeWidth={mm(width)} strokeDasharray={dash?.map(mm).join(' ')} strokeLinejoin="round" />
      {head}
    </g>
  )
}

export const PIPE_STYLE: Record<PipeRun['kind'], { color: string; width: number; dash?: number[] }> = {
  cold: { color: INK.cold, width: 0.4 },
  hot: { color: INK.hot, width: 0.35, dash: [1.4, 0.7] },
  soil: { color: INK.soil, width: 0.5 },
  waste: { color: INK.waste, width: 0.4, dash: [2, 0.8] },
  storm: { color: INK.cold, width: 0.35, dash: [0.6, 0.6] },
}

export function Pipe({ run, mm, arrow }: { run: PipeRun; mm: Mm; arrow?: boolean }) {
  const style = PIPE_STYLE[run.kind]
  return <Polyline points={run.points} color={style.color} width={style.width} dash={style.dash} mm={mm} arrow={arrow} />
}

/** Elevation / section level marker: a triangle on a leader with the level text. */
export function LevelMark({ x, y, label, mm, name }: { x: number; y: number; label: string; mm: Mm; name?: string }) {
  const s = mm(1.6)
  return (
    <g>
      <line x1={x} y1={y} x2={x + mm(22)} y2={y} stroke={INK.line} strokeWidth={mm(0.15)} />
      <path d={`M${x + mm(3)} ${y} l${-s / 1.4} ${-s} h${s * 1.4} Z`} fill={INK.line} />
      <text x={x + mm(6)} y={y - mm(0.8)} fontSize={mm(2)} fontWeight={700} fill={INK.line}>
        {label}
      </text>
      {name && (
        <text x={x + mm(6)} y={y + mm(2.6)} fontSize={mm(1.7)} fill={INK.mid}>
          {name}
        </text>
      )}
    </g>
  )
}

export function SectionMarker({ from, to, label, mm, look }: { from: Point; to: Point; label: string; mm: Mm; look: Point }) {
  const r = mm(3)
  const arrow = (p: Point) => (
    <g>
      <circle cx={p.x} cy={p.y} r={r} fill={INK.paper} stroke={INK.line} strokeWidth={mm(0.3)} />
      <path d={`M${p.x} ${p.y} l${look.x * r * 1.8 + look.y * r} ${look.y * r * 1.8 + look.x * r} l${-look.y * r * 2} ${-look.x * r * 2} Z`} fill={INK.line} />
      <text x={p.x} y={p.y + mm(1)} fontSize={mm(2.8)} fontWeight={700} textAnchor="middle" fill={INK.paper} stroke={INK.line} strokeWidth={mm(0.05)}>
        {label}
      </text>
    </g>
  )
  return (
    <g>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={INK.red} strokeWidth={mm(0.35)} strokeDasharray={`${mm(6)} ${mm(1.2)} ${mm(1)} ${mm(1.2)}`} />
      {arrow(from)}
      {arrow(to)}
    </g>
  )
}

// ---------------------------------------------------------------------------------------------
// Furniture & fixtures (top view)
// ---------------------------------------------------------------------------------------------

/** Local frame for an item: u runs along its wall, v runs from the wall into the room. */
function frame(item: PlacedItem) {
  const horizontal = item.wall === 'N' || item.wall === 'S'
  const L = horizontal ? item.width : item.height
  const D = horizontal ? item.height : item.width
  const P = (u: number, v: number): Point => {
    switch (item.wall) {
      case 'N':
        return { x: item.x + u, y: item.y + v }
      case 'S':
        return { x: item.x + u, y: item.y + item.height - v }
      case 'W':
        return { x: item.x + v, y: item.y + u }
      case 'E':
        return { x: item.x + item.width - v, y: item.y + u }
    }
  }
  const R = (u: number, v: number, du: number, dv: number): Rect => {
    const a = P(u, v)
    const b = P(u + du, v + dv)
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
  }
  return { L, D, P, R }
}

export function ItemSymbol({ item, mm, color = INK.mid }: { item: PlacedItem; mm: Mm; color?: string }) {
  const { L, D, P, R } = frame(item)
  const sw = mm(0.18)
  const base = { fill: INK.paper, stroke: color, strokeWidth: sw }
  const thin = { fill: 'none', stroke: color, strokeWidth: mm(0.12) }
  const c = { x: item.x + item.width / 2, y: item.y + item.height / 2 }
  const line = (u1: number, v1: number, u2: number, v2: number, style = thin) => {
    const a = P(u1, v1)
    const b = P(u2, v2)
    return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...style} />
  }
  let detail: ReactNode = null
  switch (item.kind) {
    case 'bed':
      detail = (
        <>
          <rect {...R(0, 0, L, 0.35)} {...base} />
          <rect {...R(0.35, 0.55, L / 2 - 0.55, 1.2)} rx={0.2} {...base} />
          <rect {...R(L / 2 + 0.2, 0.55, L / 2 - 0.55, 1.2)} rx={0.2} {...base} />
          {line(0, D * 0.42, L, D * 0.42)}
          {line(0, D * 0.42, L * 0.3, D * 0.55)}
        </>
      )
      break
    case 'side-table':
      detail = <circle cx={c.x} cy={c.y} r={Math.min(L, D) * 0.25} {...thin} />
      break
    case 'wardrobe':
      detail = (
        <>
          {line(0, D / 2, L, D / 2)}
          {line(0, 0, L, D)}
          {line(0, D, L, 0)}
        </>
      )
      break
    case 'study':
      detail = <circle {...(() => { const p = P(L / 2, D + 0.9); return { cx: p.x, cy: p.y } })()} r={0.75} {...base} />
      break
    case 'sofa':
    case 'armchair': {
      const arm = Math.min(0.6, L * 0.2)
      const seats = item.kind === 'sofa' ? 3 : 1
      detail = (
        <>
          <rect {...R(0, 0, L, 0.7)} {...base} />
          <rect {...R(0, 0, arm, D)} {...base} />
          <rect {...R(L - arm, 0, arm, D)} {...base} />
          {Array.from({ length: seats - 1 }, (_, i) => (
            <g key={i}>{line(arm + ((L - arm * 2) * (i + 1)) / seats, 0.7, arm + ((L - arm * 2) * (i + 1)) / seats, D)}</g>
          ))}
        </>
      )
      break
    }
    case 'coffee-table':
      detail = <rect x={item.x + 0.25} y={item.y + 0.25} width={item.width - 0.5} height={item.height - 0.5} rx={0.2} {...thin} />
      break
    case 'tv-unit':
      detail = <rect {...R(L * 0.15, 0.25, L * 0.7, 0.25)} fill={color} />
      break
    case 'dining': {
      const chairs: ReactNode[] = []
      const n = item.width > 4.5 || item.height > 4.5 ? 3 : 2
      const horizontal = item.width >= item.height
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n
        const s = 1.3
        if (horizontal) {
          chairs.push(<rect key={`a${i}`} x={item.x + item.width * t - s / 2} y={item.y - s + 0.2} width={s} height={s - 0.3} {...base} />)
          chairs.push(<rect key={`b${i}`} x={item.x + item.width * t - s / 2} y={item.y + item.height + 0.1} width={s} height={s - 0.3} {...base} />)
        } else {
          chairs.push(<rect key={`a${i}`} x={item.x - s + 0.2} y={item.y + item.height * t - s / 2} width={s - 0.3} height={s} {...base} />)
          chairs.push(<rect key={`b${i}`} x={item.x + item.width + 0.1} y={item.y + item.height * t - s / 2} width={s - 0.3} height={s} {...base} />)
        }
      }
      detail = <>{chairs}</>
      break
    }
    case 'counter':
      return <rect x={item.x} y={item.y} width={item.width} height={item.height} fill={INK.tint} stroke={color} strokeWidth={sw} />
    case 'sink':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.width} height={item.height} rx={0.15} {...base} />
          <rect {...R(0.15, 0.15, L / 2 - 0.25, D - 0.3)} rx={0.15} {...thin} />
          <rect {...R(L / 2 + 0.1, 0.15, L / 2 - 0.25, D - 0.3)} rx={0.15} {...thin} />
        </g>
      )
    case 'hob':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.width} height={item.height} {...base} />
          {[0.28, 0.72].flatMap((u) =>
            [0.32, 0.68].map((v) => {
              const p = P(L * u, D * v)
              return <circle key={`${u}${v}`} cx={p.x} cy={p.y} r={Math.min(L, D) * 0.16} {...thin} />
            }),
          )}
        </g>
      )
    case 'fridge':
      detail = (
        <>
          {line(0, 0, L, D)}
          <text x={c.x} y={c.y + mm(0.6)} fontSize={mm(1.6)} textAnchor="middle" fill={color}>
            REF
          </text>
        </>
      )
      break
    case 'wc': {
      const bowl = P(L / 2, 0.55 + (D - 0.55) / 2)
      const horizontal = item.wall === 'N' || item.wall === 'S'
      return (
        <g>
          <rect {...R(0.1, 0, L - 0.2, 0.55)} {...base} />
          <ellipse cx={bowl.x} cy={bowl.y} rx={horizontal ? L * 0.3 : (D - 0.55) / 2} ry={horizontal ? (D - 0.55) / 2 : L * 0.3} {...base} />
        </g>
      )
    }
    case 'basin': {
      const p = P(L / 2, D * 0.55)
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.width} height={item.height} rx={0.1} {...base} />
          <ellipse cx={p.x} cy={p.y} rx={Math.min(item.width, item.height) * 0.35} ry={Math.min(item.width, item.height) * 0.3} {...thin} />
        </g>
      )
    }
    case 'shower':
      return (
        <g>
          <rect x={item.x} y={item.y} width={item.width} height={item.height} fill={INK.coldSoft} stroke={color} strokeWidth={sw} />
          <line x1={item.x} y1={item.y} x2={item.x + item.width} y2={item.y + item.height} {...thin} />
          <line x1={item.x + item.width} y1={item.y} x2={item.x} y2={item.y + item.height} {...thin} />
          <circle cx={c.x} cy={c.y} r={0.25} fill={INK.paper} stroke={color} strokeWidth={sw} />
        </g>
      )
    case 'pooja-unit':
      detail = <rect {...R(L * 0.3, 0.2, L * 0.4, D * 0.5)} fill={INK.gold} opacity={0.6} />
      break
    case 'shelf':
      detail = (
        <>
          {line(0, D * 0.5, L, D * 0.5)}
          {Array.from({ length: Math.floor(L / 1.5) }, (_, i) => (
            <g key={i}>{line((i + 1) * 1.5, 0, (i + 1) * 1.5, D)}</g>
          ))}
        </>
      )
      break
    case 'vehicle':
      detail = (
        <>
          <rect {...R(L * 0.25, 0.4, L * 0.5, D - 0.8)} rx={0.3} {...thin} />
          {line(L / 2, 0.1, L / 2, 0.6)}
          {line(L / 2, D - 0.6, L / 2, D - 0.1)}
        </>
      )
      break
    case 'custom':
      detail = (
        <>
          {line(0, 0, L, D)}
          {line(L, 0, 0, D)}
        </>
      )
      break
    default:
      break
  }
  return (
    <g>
      <rect x={item.x} y={item.y} width={item.width} height={item.height} {...base} fill={item.kind === 'vehicle' ? 'none' : INK.paper} strokeDasharray={item.kind === 'vehicle' ? `${mm(1)} ${mm(0.6)}` : undefined} />
      {detail}
    </g>
  )
}

// ---------------------------------------------------------------------------------------------
// Electrical symbols
// ---------------------------------------------------------------------------------------------

/** An electrical symbol centred at (x, y). `s` is the symbol radius in the caller's units. */
export function ElecSymbol({ kind, x, y, s }: { kind: ElecKind; x: number; y: number; s: number }) {
  const w = s * 0.14
  const text = (t: string, fill: string = INK.elec, size = 1.05) => (
    <text x={x} y={y + s * 0.38} fontSize={s * size} fontWeight={700} textAnchor="middle" fill={fill}>
      {t}
    </text>
  )
  switch (kind) {
    case 'light':
      return (
        <g>
          <circle cx={x} cy={y} r={s} fill={INK.paper} stroke={INK.elec} strokeWidth={w} />
          <path d={`M${x - s * 0.7} ${y - s * 0.7} L${x + s * 0.7} ${y + s * 0.7} M${x + s * 0.7} ${y - s * 0.7} L${x - s * 0.7} ${y + s * 0.7}`} stroke={INK.elec} strokeWidth={w} />
        </g>
      )
    case 'fan':
      return (
        <g>
          <circle cx={x} cy={y} r={s * 1.2} fill={INK.paper} stroke={INK.elec} strokeWidth={w} />
          {[0, 120, 240].map((a) => (
            <ellipse key={a} cx={x} cy={y - s * 0.55} rx={s * 0.22} ry={s * 0.55} fill={INK.elec} transform={`rotate(${a} ${x} ${y})`} />
          ))}
        </g>
      )
    case 'exhaust':
      return (
        <g>
          <rect x={x - s} y={y - s} width={s * 2} height={s * 2} fill={INK.paper} stroke={INK.elec} strokeWidth={w} />
          {text('EF', INK.elec, 0.85)}
        </g>
      )
    case 'switchboard':
      return <rect x={x - s * 0.9} y={y - s * 0.55} width={s * 1.8} height={s * 1.1} fill={INK.line} />
    case 'socket5':
    case 'socket15':
      return (
        <g>
          <path d={`M${x - s} ${y} A${s} ${s} 0 0 1 ${x + s} ${y} Z`} fill={kind === 'socket15' ? INK.elec : INK.paper} stroke={INK.elec} strokeWidth={w} />
          <line x1={x - s} y1={y + s * 0.15} x2={x + s} y2={y + s * 0.15} stroke={INK.elec} strokeWidth={w} />
        </g>
      )
    case 'ac':
      return (
        <g>
          <rect x={x - s * 1.3} y={y - s * 0.8} width={s * 2.6} height={s * 1.6} fill={INK.coldSoft} stroke={INK.cold} strokeWidth={w} />
          {text('AC', INK.cold, 0.9)}
        </g>
      )
    case 'geyser':
      return (
        <g>
          <circle cx={x} cy={y} r={s} fill={INK.redSoft} stroke={INK.hot} strokeWidth={w} />
          {text('G', INK.hot)}
        </g>
      )
    case 'tv':
      return (
        <g>
          <rect x={x - s * 1.3} y={y - s * 0.8} width={s * 2.6} height={s * 1.6} fill={INK.paper} stroke={INK.elec} strokeWidth={w} />
          {text('TV', INK.elec, 0.85)}
        </g>
      )
    case 'db':
      return (
        <g>
          <rect x={x - s * 1.4} y={y - s * 0.9} width={s * 2.8} height={s * 1.8} fill={INK.paper} stroke={INK.line} strokeWidth={w * 1.4} />
          <path d={`M${x - s * 1.4} ${y + s * 0.9} L${x + s * 1.4} ${y - s * 0.9} L${x + s * 1.4} ${y + s * 0.9} Z`} fill={INK.line} />
        </g>
      )
    case 'bell':
      return (
        <g>
          <path d={`M${x - s * 0.8} ${y + s * 0.5} Q${x - s * 0.8} ${y - s} ${x} ${y - s} Q${x + s * 0.8} ${y - s} ${x + s * 0.8} ${y + s * 0.5} Z`} fill={INK.paper} stroke={INK.elec} strokeWidth={w} />
          <circle cx={x} cy={y + s * 0.7} r={s * 0.2} fill={INK.elec} />
        </g>
      )
  }
}

/** A thin tree-like wiring arc from a switchboard to a point (curved so crossings read). */
export function WireArc({ from, to, mm, color = INK.elec }: { from: Point; to: Point; mm: Mm; color?: string }) {
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  const dx = to.x - from.x
  const dy = to.y - from.y
  const bend = 0.18
  const cx = mx - dy * bend
  const cy = my + dx * bend
  return <path d={`M${from.x} ${from.y} Q${cx} ${cy} ${to.x} ${to.y}`} fill="none" stroke={color} strokeWidth={mm(0.15)} strokeDasharray={`${mm(1)} ${mm(0.6)}`} />
}
