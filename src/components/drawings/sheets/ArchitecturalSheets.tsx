import type { ReactNode } from 'react'
import {
  type FloorModel,
  type PlanOpening,
  type Rect,
  type Side,
  EXTERIOR_WALL,
  OPPOSITE,
  OUTWARD,
  PARAPET_HEIGHT,
  PLINTH_HEIGHT,
  SLAB_THICKNESS,
  area,
  center,
  formatFeet,
  formatLevel,
  frontSide,
  sectionCut,
  unionRect,
  wallCenterOffset,
} from '@/lib/drawings/geometry'
import type { DrawingSet } from '@/lib/drawings/sheets'
import { INK, SheetFrame, Stack, legendBlock, notesBlock, tableBlock } from '../SheetFrame'
import { DimChain, Label, LevelMark, PlanBase, PlanDimensions, SectionMarker, Tag } from '../symbols'
import { type SheetProps, padBounds, sheetFloor, sheetMeta, swatch } from './common'

type Mm = (v: number) => number

function openingMark(o: PlanOpening, index: Map<string, string>) {
  return index.get(openingKey(o)) ?? ''
}

function openingKey(o: PlanOpening) {
  return `${o.kind}-${o.width}-${o.height}`
}

/** Groups identical openings into schedule types: D1, D2 … W1, W2 … V1 … MD. */
interface OpeningType {
  mark: string
  kind: PlanOpening['kind']
  width: number
  height: number
  sill: number
  count: number
}

function openingTypes(openings: PlanOpening[]) {
  const types = new Map<string, OpeningType>()
  const counters: Record<string, number> = { door: 0, window: 0, ventilator: 0, 'main-door': 0 }
  const prefix = { door: 'D', window: 'W', ventilator: 'V', 'main-door': 'MD' }
  const sorted = [...openings].sort((a, b) => a.kind.localeCompare(b.kind) || b.width - a.width)
  for (const o of sorted) {
    const key = openingKey(o)
    const existing = types.get(key)
    if (existing) {
      existing.count++
      continue
    }
    counters[o.kind]++
    const mark = o.kind === 'main-door' ? 'MD' : `${prefix[o.kind]}${counters[o.kind]}`
    types.set(key, { mark, kind: o.kind, width: o.width, height: o.height, sill: o.sill, count: 1 })
  }
  return types
}

const OPENING_SPEC: Record<PlanOpening['kind'], string> = {
  'main-door': 'Teak wood panelled, 2" frame',
  door: 'Flush door, hardwood frame',
  window: 'UPVC sliding, 5mm glass + MS grill',
  ventilator: 'UPVC louvred, frosted glass',
}

/** Tags sit outside for exterior openings, and on the non-swing side for internal doors. */
function openingTagPoint(o: PlanOpening, mm: Mm) {
  const c = o.wall.at + wallCenterOffset(o.wall)
  const side: Side =
    o.wall.exterior && o.wall.outside ? o.wall.outside : o.swingSide ? OPPOSITE[o.swingSide] : o.wall.orientation === 'h' ? 'N' : 'W'
  const dir = OUTWARD[side]
  const offset = o.wall.thickness / 2 + mm(3.2)
  return o.wall.orientation === 'h' ? { x: o.center, y: c + dir.y * offset } : { x: c + dir.x * offset, y: o.center }
}

export function FloorPlanSheet(props: SheetProps) {
  const { set, sheet } = props
  const model = sheetFloor(props)
  const fp = model.footprint
  const types = openingTypes(model.openings)
  const markIndex = new Map([...types.entries()].map(([k, v]) => [k, v.mark]))
  const lowest = set.models[0]
  const cutX = lowest.footprint ? sectionCut(lowest.walls, lowest.footprint, 'x') : 0
  const cutY = lowest.footprint ? sectionCut(lowest.walls, lowest.footprint, 'y') : 0
  const span = fp ? Math.max(fp.width, fp.height) : 30
  const bounds = padBounds(fp, span * 0.22 + 4, { x: 0, y: 0, width: set.plot.width, height: set.plot.height })
  const carpet = model.rooms.reduce((s, r) => s + area(r), 0)

  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: `FFL ${formatLevel(model.floor.elevation)}` })}
      bounds={bounds}
      northArrow
      aside={{
        width: 92,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Room schedule',
                [
                  { title: 'ROOM', width: 0.36, value: (r: (typeof model.rooms)[number]) => r.name },
                  { title: 'SIZE', width: 0.3, value: (r) => `${formatFeet(r.width)}×${formatFeet(r.height)}` },
                  { title: 'AREA', width: 0.14, align: 'end', value: (r) => String(Math.round(area(r))) },
                  { title: 'FLOOR', width: 0.2, align: 'end', value: (r) => r.room.floorFinish },
                ],
                model.rooms,
                { footer: ['Carpet area', '', String(Math.round(carpet)), 'sft'] },
              ),
              tableBlock(
                'Door & window schedule',
                [
                  { title: 'MARK', width: 0.12, value: (t: OpeningType) => t.mark },
                  { title: 'SIZE (W×H)', width: 0.24, value: (t) => `${formatFeet(t.width)}×${formatFeet(t.height)}` },
                  { title: 'SILL', width: 0.12, value: (t) => (t.sill ? formatFeet(t.sill) : '—') },
                  { title: 'SPECIFICATION', width: 0.42, value: (t) => OPENING_SPEC[t.kind] },
                  { title: 'NOS', width: 0.1, align: 'end', value: (t) => String(t.count) },
                ],
                [...types.values()],
              ),
            ]}
          />
        ),
      }}
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            legendBlock('Legend', [
              { label: '9" external brick wall', symbol: swatch.fill(INK.poche) },
              { label: '4½" partition wall', symbol: <rect x={-3} y={-0.9} width={6} height={1.8} fill={INK.poche} /> },
              { label: 'Window', symbol: <g stroke={INK.cold} strokeWidth={0.25}><line x1={-3} x2={3} y1={-1} y2={-1} /><line x1={-3} x2={3} y1={0} y2={0} /><line x1={-3} x2={3} y1={1} y2={1} /></g> },
              { label: 'Section line', symbol: swatch.line(INK.red, 0.35, '3 0.6 0.5 0.6') },
            ]),
            notesBlock('Notes', [
              'All dimensions are clear internal room sizes; walls are additional.',
              'Lintel level 7\'-0" above FFL throughout.',
              'Wet areas to be 1" below adjoining floor with 1:100 slope to floor trap.',
              'Doors marked D open into rooms; bathroom doors to have louvres.',
            ], 44),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <PlanBase model={model} mm={mm} />
          <PlanDimensions model={model} mm={mm} />
          {model.openings.map((o) => {
            const p = openingTagPoint(o, mm)
            return <Tag key={o.id} x={p.x} y={p.y} text={openingMark(o, markIndex)} mm={mm} shape="box" size={1.6} color={o.kind === 'window' || o.kind === 'ventilator' ? INK.cold : INK.line} />
          })}
          {fp && (
            <g>
              <SectionMarker from={{ x: cutX, y: fp.y - mm(6) }} to={{ x: cutX, y: fp.y + fp.height + mm(6) }} label="A" mm={mm} look={{ x: 1, y: 0 }} />
              <SectionMarker from={{ x: fp.x - mm(6), y: cutY }} to={{ x: fp.x + fp.width + mm(6), y: cutY }} label="B" mm={mm} look={{ x: 0, y: -1 }} />
            </g>
          )}
          {model.openings
            .filter((o) => o.kind === 'main-door')
            .map((o) => {
              const p = openingTagPoint(o, mm)
              const out = OUTWARD[o.wall.outside ?? 'N']
              return <Label key={o.id} x={p.x + out.x * mm(8)} y={p.y + out.y * mm(8)} text="ENTRY" mm={mm} size={2} weight={700} color={INK.red} />
            })}
        </g>
      )}
    </SheetFrame>
  )
}

// ---------------------------------------------------------------------------------------------
// Roof plan
// ---------------------------------------------------------------------------------------------

export function RoofPlanSheet(props: SheetProps) {
  const { set, sheet } = props
  const footprints = set.models.map((m) => m.footprint).filter((f): f is Rect => !!f)
  const all = unionRect(footprints)
  const bounds = padBounds(all, (all ? Math.max(all.width, all.height) : 30) * 0.2 + 4, { x: 0, y: 0, width: set.plot.width, height: set.plot.height })
  const top = set.models[set.models.length - 1]
  const roofLevel = top ? top.floor.elevation + top.height : 0
  const wet = top?.rooms.find((r) => r.type === 'wet') ?? top?.rooms[0]
  const tank = wet ? { x: center(wet).x - 3, y: center(wet).y - 2, width: 6, height: 4 } : null

  const rwps: { x: number; y: number }[] = []
  for (const fp of footprints) {
    const i = EXTERIOR_WALL + 0.4
    for (const p of [
      { x: fp.x + i, y: fp.y + i },
      { x: fp.x + fp.width - i, y: fp.y + i },
      { x: fp.x + i, y: fp.y + fp.height - i },
      { x: fp.x + fp.width - i, y: fp.y + fp.height - i },
    ]) {
      const coveredAbove = footprints.some((f) => f !== fp && footprints.indexOf(f) > footprints.indexOf(fp) && p.x > f.x && p.x < f.x + f.width && p.y > f.y && p.y < f.y + f.height)
      if (!coveredAbove && !rwps.some((r) => Math.hypot(r.x - p.x, r.y - p.y) < 2)) rwps.push(p)
    }
  }

  // Solar PV rows on the southern half of the top roof, clear of the tank.
  const panels: Rect[] = []
  if (top?.footprint) {
    const r = top.footprint
    const inner = { x: r.x + EXTERIOR_WALL + 1.5, y: r.y + r.height / 2, width: r.width - EXTERIOR_WALL * 2 - 3, height: r.height / 2 - EXTERIOR_WALL - 1.5 }
    const pw = 3.4
    const ph = 5.6
    for (let y = inner.y; y + ph <= inner.y + inner.height; y += ph + 2) {
      for (let x = inner.x; x + pw <= inner.x + inner.width; x += pw + 0.2) {
        const p = { x, y, width: pw, height: ph }
        if (tank && !(p.x + p.width < tank.x - 1 || p.x > tank.x + tank.width + 1 || p.y + p.height < tank.y - 1 || p.y > tank.y + tank.height + 1)) continue
        panels.push(p)
      }
    }
  }

  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: `Top of slab ${formatLevel(roofLevel)}` })}
      bounds={bounds}
      northArrow
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            legendBlock('Legend', [
              { label: 'Main roof', symbol: swatch.fill(INK.paper) },
              { label: 'Lower roof', symbol: swatch.fill(INK.tint) },
              { label: '9" parapet, 3\'-6" high', symbol: swatch.fill(INK.poche) },
              { label: 'Rain water pipe 100Ø', symbol: <circle r={1.3} fill={INK.cold} /> },
              { label: 'Solar PV module', symbol: swatch.fill(INK.coldSoft, INK.cold) },
              { label: 'Roof slope', symbol: <path d="M-3 0 H2 M2 0 l-1.2 -0.8 v1.6 z" stroke={INK.line} strokeWidth={0.3} fill={INK.line} /> },
            ]),
            notesBlock('Roof notes', [
              'Brickbat coba / APP membrane waterproofing with 1:100 slope towards RWPs.',
              'Weathering course with china mosaic finish on exposed roofs.',
              `${rwps.length} nos. 100Ø UPVC rain water pipes; roof water to recharge pit.`,
              `Overhead tank 2000 L on 3'-0" platform; ${panels.length} solar modules (~${((panels.length * 0.54)).toFixed(1)} kWp).`,
            ], 44),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          {set.models.map((m, i) => {
            if (!m.footprint) return null
            const fp = m.footprint
            const isTop = i === set.models.length - 1
            const inner = { x: fp.x + EXTERIOR_WALL, y: fp.y + EXTERIOR_WALL, width: fp.width - EXTERIOR_WALL * 2, height: fp.height - EXTERIOR_WALL * 2 }
            const c = center(fp)
            return (
              <g key={m.floor.id}>
                <rect {...fp} fill={INK.poche} />
                <rect {...inner} fill={isTop ? INK.paper : INK.tint} />
                {[
                  { x: inner.x + inner.width * 0.25, y: c.y, dx: -1, dy: 0 },
                  { x: inner.x + inner.width * 0.75, y: c.y, dx: 1, dy: 0 },
                ].map((a, j) => (
                  <g key={j}>
                    <line x1={a.x - a.dx * mm(6)} y1={a.y} x2={a.x + a.dx * mm(6)} y2={a.y} stroke={INK.line} strokeWidth={mm(0.25)} />
                    <path d={`M${a.x + a.dx * mm(6)} ${a.y} l${-a.dx * mm(1.6)} ${-mm(0.8)} v${mm(1.6)} z`} fill={INK.line} />
                  </g>
                ))}
                <Label x={c.x} y={c.y - mm(4)} text={isTop ? 'MAIN ROOF' : `ROOF OVER ${m.floor.name.toUpperCase()}`} mm={mm} size={2.2} weight={700} color={INK.line} />
                <Label x={c.x} y={c.y + mm(5)} text={`TOS ${formatLevel(m.floor.elevation + m.height)} · SLOPE 1:100`} mm={mm} size={1.8} />
              </g>
            )
          })}
          {panels.map((p, i) => (
            <g key={i}>
              <rect {...p} fill={INK.coldSoft} stroke={INK.cold} strokeWidth={mm(0.15)} />
              <line x1={p.x} y1={p.y + p.height / 2} x2={p.x + p.width} y2={p.y + p.height / 2} stroke={INK.cold} strokeWidth={mm(0.08)} />
            </g>
          ))}
          {tank && (
            <g>
              <rect {...tank} fill={INK.paper} stroke={INK.line} strokeWidth={mm(0.3)} />
              <circle cx={tank.x + 3} cy={tank.y + 2} r={1.6} fill="none" stroke={INK.cold} strokeWidth={mm(0.25)} />
              <Label x={tank.x + 3} y={tank.y + tank.height + mm(3)} text="OHT 2000 L" mm={mm} size={1.8} weight={700} color={INK.cold} />
            </g>
          )}
          {rwps.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={mm(1.3)} fill={INK.cold} />
              <Label x={p.x} y={p.y - mm(2)} text="RWP" mm={mm} size={1.5} color={INK.cold} weight={700} />
            </g>
          ))}
          {all && <DimChain axis="x" stops={[all.x, all.x + all.width]} at={all.y - mm(10)} mm={mm} />}
          {all && <DimChain axis="y" stops={[all.y, all.y + all.height]} at={all.x - mm(10)} mm={mm} />}
        </g>
      )}
    </SheetFrame>
  )
}

// ---------------------------------------------------------------------------------------------
// Elevations
// ---------------------------------------------------------------------------------------------

const FACES: { side: Side; name: string }[] = [
  { side: 'N', name: 'North' },
  { side: 'S', name: 'South' },
  { side: 'E', name: 'East' },
  { side: 'W', name: 'West' },
]

/** Maps a plan coordinate along a face to elevation u (left→right as seen from outside). */
function faceMapper(side: Side, set: DrawingSet) {
  const { width, height } = set.plot
  switch (side) {
    case 'N':
      return { range: (r: Rect): [number, number] => [width - r.x - r.width, width - r.x], at: (x: number) => width - x, useX: true }
    case 'S':
      return { range: (r: Rect): [number, number] => [r.x, r.x + r.width], at: (x: number) => x, useX: true }
    case 'E':
      return { range: (r: Rect): [number, number] => [height - r.y - r.height, height - r.y], at: (y: number) => height - y, useX: false }
    case 'W':
      return { range: (r: Rect): [number, number] => [r.y, r.y + r.height], at: (y: number) => y, useX: false }
  }
}

function elevationExtent(set: DrawingSet, side: Side) {
  const map = faceMapper(side, set)
  const ranges = set.models.filter((m) => m.footprint).map((m) => map.range(m.footprint!))
  const u0 = Math.min(...ranges.map((r) => r[0]))
  const u1 = Math.max(...ranges.map((r) => r[1]))
  const top = Math.max(...set.models.map((m) => m.floor.elevation + m.height)) + PARAPET_HEIGHT
  return { u0, u1, top }
}

function Elevation({ set, side, mm, ox, oy }: { set: DrawingSet; side: Side; mm: Mm; ox: number; oy: number }) {
  const map = faceMapper(side, set)
  const { u0, u1, top } = elevationExtent(set, side)
  const X = (u: number) => ox + (u - u0)
  const Y = (z: number) => oy - z
  const parts: ReactNode[] = []

  set.models.forEach((m, i) => {
    if (!m.footprint) return
    const [a, b] = map.range(m.footprint)
    const z0 = m.floor.elevation
    const z1 = z0 + m.height
    const isTop = i === set.models.length - 1
    parts.push(
      <g key={`f${m.floor.id}`}>
        <rect x={X(a)} y={Y(z1)} width={b - a} height={z1 - z0} fill={INK.paper} stroke={INK.line} strokeWidth={mm(0.35)} />
        <rect x={X(a) - 0.25} y={Y(z1)} width={b - a + 0.5} height={SLAB_THICKNESS + 0.35} fill={INK.tint} stroke={INK.line} strokeWidth={mm(0.2)} />
        <rect x={X(a)} y={Y(z1 + PARAPET_HEIGHT)} width={b - a} height={PARAPET_HEIGHT} fill={isTop ? INK.paper : INK.paper} stroke={INK.line} strokeWidth={mm(0.3)} />
        <line x1={X(a)} x2={X(b)} y1={Y(z1 + PARAPET_HEIGHT - 0.35)} y2={Y(z1 + PARAPET_HEIGHT - 0.35)} stroke={INK.line} strokeWidth={mm(0.15)} />
      </g>,
    )
    for (const o of m.openings.filter((op) => op.wall.exterior && op.wall.outside === side)) {
      const uc = map.at(o.center)
      const x = X(uc - o.width / 2)
      const w = o.width
      if (o.kind === 'door' || o.kind === 'main-door') {
        parts.push(
          <g key={o.id}>
            <rect x={x} y={Y(z0 + o.height)} width={w} height={o.height} fill={INK.paving} stroke={INK.line} strokeWidth={mm(0.3)} />
            <rect x={x + w * 0.15} y={Y(z0 + o.height - 0.8)} width={w * 0.7} height={o.height * 0.35} fill="none" stroke={INK.mid} strokeWidth={mm(0.15)} />
            <rect x={x + w * 0.15} y={Y(z0 + o.height * 0.5)} width={w * 0.7} height={o.height * 0.38} fill="none" stroke={INK.mid} strokeWidth={mm(0.15)} />
            <rect x={x - 0.6} y={Y(z0 + o.height + 0.5)} width={w + 1.2} height={0.5} fill={INK.tint} stroke={INK.line} strokeWidth={mm(0.15)} />
          </g>,
        )
      } else {
        const zs = z0 + o.sill
        parts.push(
          <g key={o.id}>
            <rect x={x} y={Y(zs + o.height)} width={w} height={o.height} fill={INK.coldSoft} stroke={INK.line} strokeWidth={mm(0.3)} />
            <line x1={x + w / 2} x2={x + w / 2} y1={Y(zs + o.height)} y2={Y(zs)} stroke={INK.line} strokeWidth={mm(0.15)} />
            {o.kind === 'window' && (
              <>
                <line x1={x} x2={x + w} y1={Y(zs + o.height * 0.7)} y2={Y(zs + o.height * 0.7)} stroke={INK.line} strokeWidth={mm(0.12)} />
                <rect x={x - 0.4} y={Y(zs + o.height + 0.35)} width={w + 0.8} height={0.35} fill={INK.tint} stroke={INK.line} strokeWidth={mm(0.15)} />
                <rect x={x - 0.25} y={Y(zs)} width={w + 0.5} height={0.2} fill={INK.line} />
              </>
            )}
          </g>,
        )
      }
    }
  })

  const levels = set.models.map((m) => ({ z: m.floor.elevation, name: `${m.floor.name} FFL` }))
  const last = set.models[set.models.length - 1]
  if (last) levels.push({ z: last.floor.elevation + last.height, name: 'Terrace' })
  const face = FACES.find((f) => f.side === side)!

  return (
    <g>
      <rect x={X(u0) - 4} y={Y(-PLINTH_HEIGHT)} width={u1 - u0 + 8} height={1.2} fill="url(#hatch-earth)" />
      <rect x={X(u0) - 0.3} y={Y(0)} width={u1 - u0 + 0.6} height={PLINTH_HEIGHT} fill={INK.tint} stroke={INK.line} strokeWidth={mm(0.3)} />
      {parts}
      <line x1={X(u0) - 4} x2={X(u1) + 4} y1={Y(-PLINTH_HEIGHT)} y2={Y(-PLINTH_HEIGHT)} stroke={INK.line} strokeWidth={mm(0.6)} />
      {levels.map((l) => (
        <LevelMark key={l.name} x={X(u1) + 1.5} y={Y(l.z)} label={formatLevel(l.z)} name={l.name} mm={mm} />
      ))}
      <LevelMark x={X(u1) + 1.5} y={Y(top)} label={formatLevel(top)} name="Top of parapet" mm={mm} />
      <Label x={X((u0 + u1) / 2)} y={Y(-PLINTH_HEIGHT) + mm(7)} text={`${face.name.toUpperCase()} ELEVATION${side === frontSide(set.plot) ? ' (FRONT)' : ''}`} mm={mm} size={3} weight={700} color={INK.line} />
      <line x1={X((u0 + u1) / 2) - mm(22)} x2={X((u0 + u1) / 2) + mm(22)} y1={Y(-PLINTH_HEIGHT) + mm(8.2)} y2={Y(-PLINTH_HEIGHT) + mm(8.2)} stroke={INK.line} strokeWidth={mm(0.3)} />
    </g>
  )
}

export function ElevationsSheet(props: SheetProps) {
  const { set, sheet } = props
  const extents = FACES.map((f) => ({ ...f, ...elevationExtent(set, f.side) }))
  const cellW = Math.max(...extents.map((e) => e.u1 - e.u0)) + 30
  const cellH = Math.max(...extents.map((e) => e.top)) + PLINTH_HEIGHT + 16
  const front = frontSide(set.plot)
  // Front elevation first.
  const ordered = [...extents].sort((a, b) => (a.side === front ? -1 : b.side === front ? 1 : 0))
  const bounds = { x: -4, y: -4, width: cellW * 2 + 4, height: cellH * 2 + 4 }
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet)}
      bounds={bounds}
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            legendBlock('Materials', [
              { label: 'Exterior plaster + weatherproof paint', symbol: swatch.fill(INK.paper) },
              { label: 'Glazing (UPVC frame)', symbol: swatch.fill(INK.coldSoft) },
              { label: 'Chajja / slab band', symbol: swatch.fill(INK.tint) },
              { label: 'Main door (teak)', symbol: swatch.fill(INK.paving) },
              { label: 'Natural ground', symbol: swatch.pattern('hatch-earth') },
            ]),
            notesBlock('Notes', [
              `Front (${set.plot.facing}) elevation shown first; all levels relative to FFL ±0'-0" = plinth ${formatFeet(PLINTH_HEIGHT)} above ground.`,
              '1\'-6" RCC chajjas over all windows; 2\'-0" over doors.',
              'Parapet 3\'-6" high with coping, top of parapet level as marked.',
            ], 44),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          {ordered.map((e, i) => {
            const col = i % 2
            const row = Math.floor(i / 2)
            const ox = col * cellW + 6
            const oy = row * cellH + cellH - PLINTH_HEIGHT - 12
            return <Elevation key={e.side} set={set} side={e.side} mm={mm} ox={ox} oy={oy} />
          })}
        </g>
      )}
    </SheetFrame>
  )
}

// ---------------------------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------------------------

interface CutInfo {
  axis: 'x' | 'y'
  at: number
}

/** Draws a building section; u runs along the cut plane, z is up. */
function Section({ set, cut, mm, ox, oy, title }: { set: DrawingSet; cut: CutInfo; mm: Mm; ox: number; oy: number; title: string }) {
  const parts: ReactNode[] = []
  const us: number[] = []
  const cutWalls = (m: FloorModel) =>
    m.walls.filter((w) => (cut.axis === 'x' ? w.orientation === 'h' : w.orientation === 'v') && w.from <= cut.at && w.to >= cut.at)
  for (const m of set.models) {
    for (const w of cutWalls(m)) us.push(w.at + wallCenterOffset(w) - w.thickness / 2, w.at + wallCenterOffset(w) + w.thickness / 2)
  }
  if (!us.length) return null
  const u0 = Math.min(...us)
  const u1 = Math.max(...us)
  const X = (u: number) => ox + (u - u0)
  const Y = (z: number) => oy - z

  // Earth below plinth.
  parts.push(<rect key="earth" x={X(u0) - 6} y={Y(-PLINTH_HEIGHT)} width={u1 - u0 + 12} height={5} fill="url(#hatch-earth)" />)
  parts.push(<line key="gl" x1={X(u0) - 6} x2={X(u1) + 6} y1={Y(-PLINTH_HEIGHT)} y2={Y(-PLINTH_HEIGHT)} stroke={INK.line} strokeWidth={mm(0.5)} />)

  const lowest = set.models[0]
  for (const w of lowest ? cutWalls(lowest) : []) {
    const c = w.at + wallCenterOffset(w)
    const fw = w.exterior ? 4 : 3
    parts.push(
      <g key={`fd${w.id}`}>
        <rect x={X(c - fw / 2)} y={Y(-5)} width={fw} height={1} fill="url(#hatch-concrete)" stroke={INK.line} strokeWidth={mm(0.2)} />
        <rect x={X(c - 0.6)} y={Y(-4)} width={1.2} height={4 - PLINTH_HEIGHT} fill={INK.paper} stroke={INK.line} strokeWidth={mm(0.2)} />
        <rect x={X(c - 0.5)} y={Y(-PLINTH_HEIGHT + 0.1)} width={1} height={1} fill="url(#hatch-concrete)" stroke={INK.line} strokeWidth={mm(0.2)} />
        <rect x={X(c - w.thickness / 2)} y={Y(0)} width={w.thickness} height={PLINTH_HEIGHT - 0.9} fill={INK.poche} />
      </g>,
    )
  }
  // Plinth fill under the floor.
  parts.push(<rect key="plinth" x={X(u0)} y={Y(0)} width={u1 - u0} height={PLINTH_HEIGHT} fill="url(#hatch-diag)" opacity={0.6} />)
  parts.push(<rect key="pcc" x={X(u0)} y={Y(0)} width={u1 - u0} height={0.33} fill="url(#hatch-concrete)" stroke={INK.line} strokeWidth={mm(0.15)} />)

  set.models.forEach((m, i) => {
    const z0 = m.floor.elevation
    const z1 = z0 + m.height
    const walls = cutWalls(m)
    const isTop = i === set.models.length - 1
    if (!walls.length) return
    const mu = walls.map((w) => w.at + wallCenterOffset(w))
    const a = Math.min(...mu) - EXTERIOR_WALL / 2
    const b = Math.max(...mu) + EXTERIOR_WALL / 2
    // Slab over this floor.
    parts.push(<rect key={`s${m.floor.id}`} x={X(a) - 0.4} y={Y(z1)} width={b - a + 0.8} height={SLAB_THICKNESS} fill={INK.poche} />)
    for (const w of walls) {
      const c = w.at + wallCenterOffset(w)
      const x = X(c - w.thickness / 2)
      const beamDepth = 1.25
      const opening = m.openings.find((o) => o.wall.id === w.id && Math.abs(o.center - cut.at) <= o.width / 2)
      if (opening) {
        const zb = z0 + opening.sill
        const zt = z0 + opening.sill + opening.height
        if (zb > z0) parts.push(<rect key={`wl${w.id}`} x={x} y={Y(zb)} width={w.thickness} height={zb - z0} fill={INK.poche} />)
        parts.push(<rect key={`wg${w.id}`} x={x} y={Y(zt)} width={w.thickness} height={zt - zb} fill={opening.kind === 'window' || opening.kind === 'ventilator' ? INK.coldSoft : INK.paper} stroke={INK.line} strokeWidth={mm(0.15)} />)
        parts.push(<rect key={`wu${w.id}`} x={x} y={Y(z1 - SLAB_THICKNESS)} width={w.thickness} height={z1 - SLAB_THICKNESS - zt} fill={INK.poche} />)
      } else {
        parts.push(<rect key={`w${w.id}`} x={x} y={Y(z1 - SLAB_THICKNESS)} width={w.thickness} height={m.height - SLAB_THICKNESS} fill={INK.poche} />)
      }
      parts.push(<rect key={`b${w.id}`} x={x} y={Y(z1)} width={w.thickness} height={beamDepth} fill={INK.poche} />)
      if (isTop && w.exterior) {
        parts.push(<rect key={`p${w.id}`} x={x} y={Y(z1 + PARAPET_HEIGHT)} width={w.thickness} height={PARAPET_HEIGHT} fill={INK.poche} />)
      }
    }
    // Room names in the cut spaces.
    for (const r of m.rooms) {
      const inCut = cut.axis === 'x' ? r.x < cut.at && r.x + r.width > cut.at : r.y < cut.at && r.y + r.height > cut.at
      if (!inCut) continue
      const ua = cut.axis === 'x' ? r.y : r.x
      const ub = cut.axis === 'x' ? r.y + r.height : r.x + r.width
      parts.push(<Label key={`r${r.id}`} x={X((ua + ub) / 2)} y={Y(z0 + m.height / 2)} text={r.name.toUpperCase()} mm={mm} size={Math.min(2, ((ub - ua) / mm(1)) / (r.name.length * 0.7))} weight={700} color={INK.mid} />)
      parts.push(<line key={`ff${r.id}`} x1={X(ua)} x2={X(ub)} y1={Y(z0) - 0.08} y2={Y(z0) - 0.08} stroke={INK.line} strokeWidth={mm(0.25)} />)
    }
    parts.push(<LevelMark key={`l${m.floor.id}`} x={X(u1) + 2} y={Y(z0)} label={formatLevel(z0)} name={`${m.floor.name} FFL`} mm={mm} />)
    if (isTop) parts.push(<LevelMark key="ter" x={X(u1) + 2} y={Y(z1)} label={formatLevel(z1)} name="Terrace" mm={mm} />)
  })

  const heights = [-PLINTH_HEIGHT, 0, ...set.models.map((m) => m.floor.elevation + m.height)]
  const last = set.models[set.models.length - 1]
  if (last) heights.push(last.floor.elevation + last.height + PARAPET_HEIGHT)

  return (
    <g>
      {parts}
      <DimChain axis="y" stops={heights.map((z) => Y(z))} at={X(u0) - mm(10)} mm={mm} />
      <Label x={X((u0 + u1) / 2)} y={Y(-PLINTH_HEIGHT) + mm(14)} text={title} mm={mm} size={3} weight={700} color={INK.line} />
    </g>
  )
}

export function SectionsSheet(props: SheetProps) {
  const { set, sheet } = props
  const lowest = set.models[0]
  const fp = lowest?.footprint
  const cutX = fp ? sectionCut(lowest.walls, fp, 'x') : 0
  const cutY = fp ? sectionCut(lowest.walls, fp, 'y') : 0
  const top = Math.max(0, ...set.models.map((m) => m.floor.elevation + m.height)) + PARAPET_HEIGHT
  const widthA = set.plot.height + 30
  const widthB = set.plot.width + 30
  const rowH = top + PLINTH_HEIGHT + 22
  const bounds = { x: -18, y: -4, width: Math.max(widthA, widthB) + 20, height: rowH * 2 + 4 }
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet)}
      bounds={bounds}
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            legendBlock('Legend', [
              { label: 'RCC / masonry in section', symbol: swatch.fill(INK.poche) },
              { label: 'PCC / concrete', symbol: swatch.pattern('hatch-concrete') },
              { label: 'Plinth filling', symbol: swatch.pattern('hatch-diag') },
              { label: 'Natural earth', symbol: swatch.pattern('hatch-earth') },
            ]),
            notesBlock('Notes', [
              `Section A-A cut at x = ${formatFeet(cutX)} looking east; B-B at y = ${formatFeet(cutY)} looking north (see floor plans).`,
              'Slab 5" thk RCC; beams 9" wide as per structural drawings.',
              'Footings at 5\'-0" below natural ground level, on PCC 1:4:8 bed 4" thk.',
              'Plinth filled with murrum in 6" layers, well compacted.',
            ], 44),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <Section set={set} cut={{ axis: 'x', at: cutX }} mm={mm} ox={0} oy={rowH - PLINTH_HEIGHT - 16} title="SECTION A-A" />
          <Section set={set} cut={{ axis: 'y', at: cutY }} mm={mm} ox={0} oy={rowH * 2 - PLINTH_HEIGHT - 16} title="SECTION B-B" />
        </g>
      )}
    </SheetFrame>
  )
}
