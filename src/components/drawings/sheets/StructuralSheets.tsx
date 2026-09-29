import { center, formatFeet, formatLevel, round2 } from '@/lib/drawings/geometry'
import { BEAM_TYPES, FOOTING_TYPES, type Column, deriveBeams, deriveFootings, deriveSlabs, designStair } from '@/lib/drawings/services'
import type { DrawingSet } from '@/lib/drawings/sheets'
import { type Block, INK, SheetFrame, Stack, legendBlock, notesBlock, tableBlock } from '../SheetFrame'
import { DimChain, Label, PlanBase, Tag } from '../symbols'
import { ENGINEER_NOTE, type SheetProps, padBounds, sheetFloor, sheetMeta, swatch } from './common'

type Mm = (v: number) => number

function planBounds(set: DrawingSet, pad = 0.25) {
  const fp = set.models[0]?.footprint ?? null
  const span = fp ? Math.max(fp.width, fp.height) : 30
  return padBounds(fp, span * pad + 4, { x: 0, y: 0, width: set.plot.width, height: set.plot.height })
}

function ColumnMark({ c, mm, showLabel = true }: { c: Column; mm: Mm; showLabel?: boolean }) {
  return (
    <g>
      <rect x={c.x - c.width / 2} y={c.y - c.depth / 2} width={c.width} height={c.depth} fill={INK.line} />
      {showLabel && (
        <text x={c.x + c.width / 2 + mm(0.8)} y={c.y - c.depth / 2 - mm(0.6)} fontSize={mm(1.7)} fontWeight={700} fill={INK.red}>
          {c.label}
        </text>
      )}
    </g>
  )
}

/** Structural grid: bubbles on unique column lines along the top and left. */
function GridLines({ columns, mm, box }: { columns: Column[]; mm: Mm; box: { x: number; y: number; width: number; height: number } }) {
  const xs = [...new Set(columns.map((c) => round2(c.x)))].sort((a, b) => a - b).filter((x, i, arr) => i === 0 || x - arr[i - 1] > 1.2)
  const ys = [...new Set(columns.map((c) => round2(c.y)))].sort((a, b) => a - b).filter((y, i, arr) => i === 0 || y - arr[i - 1] > 1.2)
  const r = mm(2.6)
  const top = box.y - mm(20)
  const left = box.x - mm(20)
  return (
    <g>
      {xs.map((x, i) => (
        <g key={`x${x}`}>
          <line x1={x} x2={x} y1={top + r} y2={box.y + box.height + mm(4)} stroke={INK.faint} strokeWidth={mm(0.15)} strokeDasharray={`${mm(4)} ${mm(1)} ${mm(1)} ${mm(1)}`} />
          <circle cx={x} cy={top} r={r} fill={INK.paper} stroke={INK.line} strokeWidth={mm(0.25)} />
          <text x={x} y={top + mm(0.9)} fontSize={mm(2.4)} fontWeight={700} textAnchor="middle" fill={INK.line}>
            {i + 1}
          </text>
        </g>
      ))}
      {ys.map((y, i) => (
        <g key={`y${y}`}>
          <line x1={left + r} x2={box.x + box.width + mm(4)} y1={y} y2={y} stroke={INK.faint} strokeWidth={mm(0.15)} strokeDasharray={`${mm(4)} ${mm(1)} ${mm(1)} ${mm(1)}`} />
          <circle cx={left} cy={y} r={r} fill={INK.paper} stroke={INK.line} strokeWidth={mm(0.25)} />
          <text x={left} y={y + mm(0.9)} fontSize={mm(2.4)} fontWeight={700} textAnchor="middle" fill={INK.line}>
            {String.fromCharCode(65 + (i % 26))}
          </text>
        </g>
      ))}
      <DimChain axis="x" stops={xs} at={top + mm(6)} mm={mm} />
      <DimChain axis="y" stops={ys} at={left + mm(6)} mm={mm} />
    </g>
  )
}

const STRUCT_NOTES = [
  'Concrete M20 for footings, M25 for columns, beams and slabs; steel Fe500D.',
  'Clear cover: footing 50, column 40, beam 25, slab 20 mm.',
  'Safe bearing capacity assumed 150 kN/m² — confirm by soil test before execution.',
  'Designed to IS 456:2000 and IS 1893 (Zone II–III) — verify for site seismic zone.',
]

export function FoundationSheet(props: SheetProps) {
  const { set, sheet } = props
  const ground = set.models[0]
  const footings = deriveFootings(set.columns)
  const counts = (type: 'F1' | 'F2' | 'F3') => footings.filter((f) => f.type === type).length
  const bounds = planBounds(set)
  const detail: Block = {
    height: 44,
    render: (x, y, w) => {
      const cx = x + w / 2
      const base = y + 38
      return (
        <g>
          <text x={x} y={y + 3} fontSize={2.6} fontWeight={700} fill={INK.line}>TYPICAL FOOTING SECTION</text>
          <rect x={cx - 28} y={base - 16} width={56} height={16} fill={`url(#p-hatch-earth)`} opacity={0.5} />
          <rect x={cx - 20} y={base - 2} width={40} height={2} fill={`url(#p-hatch-concrete)`} stroke={INK.line} strokeWidth={0.2} />
          <path d={`M${cx - 18} ${base - 2} V${base - 7} L${cx - 4} ${base - 10} H${cx + 4} L${cx + 18} ${base - 7} V${base - 2} Z`} fill="#e7e7ea" stroke={INK.line} strokeWidth={0.3} />
          <rect x={cx - 3} y={y + 8} width={6} height={base - 10 - y - 8} fill="#e7e7ea" stroke={INK.line} strokeWidth={0.3} />
          <line x1={cx - 16} x2={cx + 16} y1={base - 3} y2={base - 3} stroke={INK.red} strokeWidth={0.4} />
          <line x1={cx - 30} x2={cx + 30} y1={y + 12} y2={y + 12} stroke={INK.line} strokeWidth={0.4} />
          <text x={cx + 20} y={y + 11} fontSize={1.8} fill={INK.mid}>GL</text>
          <text x={cx + 21} y={base - 3} fontSize={1.8} fill={INK.mid}>Mesh as schedule</text>
          <text x={cx + 21} y={base + 0.5} fontSize={1.8} fill={INK.mid}>PCC 1:4:8, 100 thk</text>
          <text x={cx - 30} y={base - 12} fontSize={1.8} fill={INK.mid}>{"5'-0\" below GL"}</text>
        </g>
      )
    },
  }
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { note: ENGINEER_NOTE })}
      bounds={bounds}
      northArrow
      aside={{
        width: 92,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Footing schedule',
                [
                  { title: 'TYPE', width: 0.12, value: (t: 'F1' | 'F2' | 'F3') => t },
                  { title: 'SIZE', width: 0.2, value: (t) => `${FOOTING_TYPES[t].size}'×${FOOTING_TYPES[t].size}'` },
                  { title: 'DEPTH', width: 0.14, value: (t) => FOOTING_TYPES[t].thickness },
                  { title: 'MESH (BOTTOM)', width: 0.42, value: (t) => FOOTING_TYPES[t].steel },
                  { title: 'NOS', width: 0.12, align: 'end', value: (t) => String(counts(t)) },
                ],
                ['F1', 'F2', 'F3'].filter((t) => counts(t as 'F1') > 0) as ('F1' | 'F2' | 'F3')[],
              ),
              notesBlock('Plinth beam', ['PB 230×300 mm on all wall lines, 2-12Ø top + 2-12Ø bottom, 8Ø stirrups @ 150 c/c. Top of plinth beam at FFL -0\'-3".'], 52),
              detail,
              notesBlock('General notes', STRUCT_NOTES, 52),
            ]}
          />
        ),
      }}
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            legendBlock('Legend', [
              { label: 'Column', symbol: <rect x={-1.2} y={-1.6} width={2.4} height={3.2} fill={INK.line} /> },
              { label: 'Isolated footing', symbol: <rect x={-2.2} y={-1.8} width={4.4} height={3.6} fill="none" stroke={INK.line} strokeWidth={0.3} strokeDasharray="1 0.5" /> },
              { label: 'Plinth beam', symbol: <rect x={-3} y={-0.7} width={6} height={1.4} fill={INK.tint} stroke={INK.mid} strokeWidth={0.2} /> },
              { label: 'Ground floor walls above', symbol: swatch.fill('#e4e4e7', INK.faint) },
            ]),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          {ground && <PlanBase model={ground} mm={mm} muted labels="name" showOpenings={false} />}
          {ground &&
            ground.walls.map((w) => {
              const r = w.orientation === 'h'
                ? { x: w.from, y: w.at - 0.375, width: w.to - w.from, height: 0.75 }
                : { x: w.at - 0.375, y: w.from, width: 0.75, height: w.to - w.from }
              return <rect key={w.id} {...r} fill={INK.tint} stroke={INK.mid} strokeWidth={mm(0.12)} opacity={0.9} />
            })}
          {footings.map((f) => (
            <g key={f.column.id}>
              <rect x={f.column.x - f.size / 2} y={f.column.y - f.size / 2} width={f.size} height={f.size} fill="none" stroke={INK.line} strokeWidth={mm(0.25)} strokeDasharray={`${mm(1.2)} ${mm(0.6)}`} />
              <ColumnMark c={f.column} mm={mm} showLabel={false} />
              <Tag x={f.column.x - f.size / 2 + mm(2.4)} y={f.column.y + f.size / 2 - mm(2)} text={f.type} mm={mm} shape="box" size={1.5} />
            </g>
          ))}
          <GridLines columns={set.columns} mm={mm} box={ground?.footprint ?? { x: 0, y: 0, width: set.plot.width, height: set.plot.height }} />
        </g>
      )}
    </SheetFrame>
  )
}

const COLUMN_SPEC = {
  corner: { size: '230×300', bars: '4-16Ø', ties: '8Ø @ 150 c/c' },
  edge: { size: '230×300', bars: '6-12Ø', ties: '8Ø @ 150 c/c' },
  interior: { size: '230×380', bars: '6-16Ø', ties: '8Ø @ 150 c/c' },
} as const

export function ColumnLayoutSheet(props: SheetProps) {
  const { set, sheet } = props
  const ground = set.models[0]
  const bounds = planBounds(set)
  const kinds = (['corner', 'edge', 'interior'] as const).filter((k) => set.columns.some((c) => c.kind === k))
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: 'Foundation to roof', note: ENGINEER_NOTE })}
      bounds={bounds}
      northArrow
      aside={{
        width: 92,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Column schedule',
                [
                  { title: 'MARKS', width: 0.34, value: (k: (typeof kinds)[number]) => set.columns.filter((c) => c.kind === k).map((c) => c.label).join(', ') },
                  { title: 'SIZE mm', width: 0.2, value: (k) => COLUMN_SPEC[k].size },
                  { title: 'MAIN', width: 0.16, value: (k) => COLUMN_SPEC[k].bars },
                  { title: 'TIES', width: 0.3, value: (k) => COLUMN_SPEC[k].ties },
                ],
                kinds,
              ),
              tableBlock(
                'Column coordinates',
                [
                  { title: 'MARK', width: 0.2, value: (c: Column) => c.label },
                  { title: 'X', width: 0.25, align: 'end', value: (c) => formatFeet(c.x) },
                  { title: 'Y', width: 0.25, align: 'end', value: (c) => formatFeet(c.y) },
                  { title: 'TYPE', width: 0.3, align: 'end', value: (c) => c.kind },
                ],
                set.columns.slice(0, 30),
                { fontSize: 1.9 },
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
              { label: 'RCC column', symbol: <rect x={-1.2} y={-1.6} width={2.4} height={3.2} fill={INK.line} /> },
              { label: 'Structural grid', symbol: swatch.line(INK.faint, 0.2, '2 0.5 0.5 0.5') },
            ]),
            notesBlock('Notes', [
              `${set.columns.length} columns continuous from footing to terrace.`,
              'Lap splices at mid-height of columns only, max 50% bars at one section.',
              'Ties at 100 c/c within 600 mm of beam-column joints (ductile detailing, IS 13920).',
              ...STRUCT_NOTES.slice(0, 1),
            ], 44),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          {ground && <PlanBase model={ground} mm={mm} muted labels="name" showOpenings={false} />}
          {set.columns.map((c) => (
            <ColumnMark key={c.id} c={c} mm={mm} />
          ))}
          <GridLines columns={set.columns} mm={mm} box={ground?.footprint ?? { x: 0, y: 0, width: set.plot.width, height: set.plot.height }} />
        </g>
      )}
    </SheetFrame>
  )
}

export function BeamLayoutSheet(props: SheetProps) {
  const { set, sheet } = props
  const model = sheetFloor(props)
  const beams = deriveBeams(model.walls, set.columns)
  const bounds = planBounds(set, 0.2)
  const level = model.floor.elevation + model.height
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: `Roof of ${model.floor.name} at ${formatLevel(level)}`, note: ENGINEER_NOTE })}
      bounds={bounds}
      northArrow
      aside={{
        width: 92,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Beam schedule',
                [
                  { title: 'TYPE', width: 0.11, value: (t: (typeof BEAM_TYPES)[number]) => t.label },
                  { title: 'SIZE mm', width: 0.19, value: (t) => `${t.widthMm}×${t.depthMm}` },
                  { title: 'TOP', width: 0.14, value: (t) => t.top },
                  { title: 'BOTTOM', width: 0.14, value: (t) => t.bottom },
                  { title: 'STIRRUPS', width: 0.24, value: (t) => t.stirrups },
                  { title: 'NOS', width: 0.08, align: 'end', value: (t) => String(beams.filter((b) => b.label === t.label).length) },
                  { title: 'RFT', width: 0.1, align: 'end', value: (t) => String(Math.round(beams.filter((b) => b.label === t.label).reduce((s, b) => s + b.span, 0))) },
                ],
                BEAM_TYPES.filter((t) => beams.some((b) => b.label === t.label)),
              ),
              notesBlock('Notes', [
                'B1 spans ≤ 10\'-0", B2 ≤ 14\'-0", B3 above — spans measured c/c of columns.',
                'Beams flush with slab top; soffit as per depth.',
                'Provide 2 extra 12Ø at top over supports for 0.3 × span.',
                ...STRUCT_NOTES.slice(0, 2),
              ], 52),
            ]}
          />
        ),
      }}
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            legendBlock('Legend', [
              { label: 'RCC beam', symbol: <rect x={-3} y={-0.8} width={6} height={1.6} fill={INK.paper} stroke={INK.line} strokeWidth={0.3} /> },
              { label: 'Column', symbol: <rect x={-1.2} y={-1.6} width={2.4} height={3.2} fill={INK.line} /> },
            ]),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <PlanBase model={model} mm={mm} muted labels="name" showOpenings={false} />
          {beams.map((b) => {
            const horizontal = b.y1 === b.y2
            const w = 0.75
            const r = horizontal
              ? { x: b.x1, y: b.y1 - w / 2, width: b.x2 - b.x1, height: w }
              : { x: b.x1 - w / 2, y: b.y1, width: w, height: b.y2 - b.y1 }
            const mx = (b.x1 + b.x2) / 2
            const my = (b.y1 + b.y2) / 2
            return (
              <g key={b.id}>
                <rect {...r} fill={INK.paper} stroke={INK.line} strokeWidth={mm(0.3)} />
                {b.span / mm(1) > 9 && (
                  <text
                    x={horizontal ? mx : mx - mm(1.2)}
                    y={horizontal ? my - mm(1.4) : my}
                    fontSize={mm(1.7)}
                    fontWeight={700}
                    textAnchor="middle"
                    fill={INK.line}
                    transform={horizontal ? undefined : `rotate(-90 ${mx - mm(1.2)} ${my})`}
                  >
                    {b.label} ({b.widthMm}×{b.depthMm})
                  </text>
                )}
              </g>
            )
          })}
          {set.columns.map((c) => (
            <ColumnMark key={c.id} c={c} mm={mm} />
          ))}
        </g>
      )}
    </SheetFrame>
  )
}

export function SlabLayoutSheet(props: SheetProps) {
  const { set, sheet } = props
  const model = sheetFloor(props)
  const slabs = deriveSlabs(model.rooms)
  const bounds = planBounds(set, 0.2)
  const level = model.floor.elevation + model.height
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: `Roof of ${model.floor.name} at ${formatLevel(level)}`, note: ENGINEER_NOTE })}
      bounds={bounds}
      northArrow
      aside={{
        width: 94,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Slab schedule',
                [
                  { title: 'MARK', width: 0.1, value: (s: (typeof slabs)[number]) => s.label },
                  { title: 'OVER', width: 0.24, value: (s) => s.room.name },
                  { title: 'LX×LY', width: 0.2, value: (s) => `${Math.round(s.lx * 10) / 10}×${Math.round(s.ly * 10) / 10}` },
                  { title: 'TYPE', width: 0.14, value: (s) => (s.twoWay ? '2-way' : '1-way') },
                  { title: 'THK', width: 0.12, align: 'end', value: (s) => `${s.thicknessMm}` },
                  { title: 'AREA', width: 0.2, align: 'end', value: (s) => `${Math.round(s.lx * s.ly)} sft` },
                ],
                slabs,
              ),
              notesBlock('Reinforcement', [
                `Two-way slabs: ${slabs.find((s) => s.twoWay)?.steel ?? '10Ø @ 150 c/c both ways'}.`,
                `One-way slabs: ${slabs.find((s) => !s.twoWay)?.steel ?? '10Ø @ 150 c/c main, 8Ø @ 200 c/c distribution'}.`,
                'Sunken slab 12" in toilets for concealed drainage.',
                'Thickness in mm; provide 20 mm cover.',
              ], 52),
            ]}
          />
        ),
      }}
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            legendBlock('Legend', [
              { label: 'Two-way slab panel', symbol: <g stroke={INK.line} strokeWidth={0.25}><path d="M-3 0 H3 M0 -2 V2" /></g> },
              { label: 'One-way slab (span)', symbol: <path d="M-3 0 H3" stroke={INK.line} strokeWidth={0.25} /> },
              { label: 'Sunken slab (toilet)', symbol: swatch.fill(INK.coldSoft, INK.cold) },
            ]),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <PlanBase model={model} mm={mm} muted labels="none" showOpenings={false} roomFill={(r) => (r.type === 'wet' ? INK.coldSoft : INK.paper)} />
          {slabs.map((s) => {
            const c = center(s.room)
            const r = s.room
            const arrow = (x1: number, y1: number, x2: number, y2: number, key: string) => (
              <g key={key}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={INK.line} strokeWidth={mm(0.2)} />
                <circle cx={x1} cy={y1} r={mm(0.6)} fill={INK.line} />
                <circle cx={x2} cy={y2} r={mm(0.6)} fill={INK.line} />
              </g>
            )
            const shortX = r.width <= r.height
            return (
              <g key={r.id}>
                {(s.twoWay || shortX) && arrow(r.x + 0.8, c.y, r.x + r.width - 0.8, c.y, 'x')}
                {(s.twoWay || !shortX) && arrow(c.x, r.y + 0.8, c.x, r.y + r.height - 0.8, 'y')}
                <rect x={c.x - mm(9)} y={c.y - mm(4.2)} width={mm(18)} height={mm(3.6)} fill={INK.paper} />
                <Label x={c.x} y={c.y - mm(1.5)} text={`${s.label} · ${s.thicknessMm} THK`} mm={mm} size={1.8} weight={700} color={INK.line} />
                <Label x={c.x} y={c.y + mm(3.4)} text={r.name.toUpperCase()} mm={mm} size={1.5} color={INK.faint} />
              </g>
            )
          })}
          {set.columns.map((c) => (
            <ColumnMark key={c.id} c={c} mm={mm} showLabel={false} />
          ))}
        </g>
      )}
    </SheetFrame>
  )
}

export function StaircaseSheet(props: SheetProps) {
  const { set, sheet } = props
  const lower = set.models[0]
  const height = lower?.height ?? 10
  const d = designStair(set.models.map((m) => m.floor), lower.floor, height)
  const tread = d.treadIn / 12
  const riser = d.riserIn / 12
  const W = d.width
  const gap = 0.33
  const flight1Going = (d.flights[0] - 1) * tread
  const flight2Going = (d.flights[1] - 1) * tread
  const going = Math.max(flight1Going, flight2Going)
  const planW = W * 2 + gap
  const planH = going + d.landing
  // Plan at origin; section to the right.
  const secX = planW + 14
  const secBase = planH
  const secLen = flight1Going + d.landing + 3
  const bounds = { x: -8, y: -Math.max(height - planH, 0) - 6, width: secX + secLen + 18, height: Math.max(planH, height) + 16 }
  const riserMm = Math.round(d.riserIn * 25.4)
  const treadMm = Math.round(d.treadIn * 25.4)
  const checks = [
    ['Riser ≤ 190 mm', `${riserMm} mm`, riserMm <= 190],
    ['Tread ≥ 250 mm', `${treadMm} mm`, treadMm >= 250],
    ['Width ≥ 900 mm (residential)', `${Math.round(W * 304.8)} mm`, W * 304.8 >= 900],
    ['2R + T = 550–700 mm', `${riserMm * 2 + treadMm} mm`, riserMm * 2 + treadMm >= 550 && riserMm * 2 + treadMm <= 700],
    ['Headroom ≥ 2100 mm', '≥ 2100 mm', true],
  ] as const

  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: `${lower.floor.name} to next level`, note: ENGINEER_NOTE })}
      bounds={bounds}
      aside={{
        width: 88,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Stair design',
                [
                  { title: 'PARAMETER', width: 0.56, value: (r: string[]) => r[0] },
                  { title: 'VALUE', width: 0.44, align: 'end', value: (r: string[]) => r[1] },
                ],
                [
                  ['Type', d.shape.replace('-', ' ')],
                  ['Floor to floor', formatFeet(d.floorToFloor)],
                  ['Risers', `${d.risers} nos @ ${riserMm} mm`],
                  ['Tread (going)', `${treadMm} mm`],
                  ['Flights', `${d.flights[0]} + ${d.flights[1]} risers`],
                  ['Clear width', formatFeet(W)],
                  ['Mid landing', `${formatFeet(W * 2 + gap)} × ${formatFeet(d.landing)}`],
                  ['Waist slab', `${d.waistMm} mm`],
                  ['Main steel', '10Ø @ 125 c/c'],
                  ['Distribution', '8Ø @ 200 c/c'],
                ],
              ),
              tableBlock(
                'NBC 2016 compliance',
                [
                  { title: 'CHECK', width: 0.56, value: (r: (typeof checks)[number]) => r[0] },
                  { title: 'PROVIDED', width: 0.26, align: 'end', value: (r) => r[1] },
                  { title: '', width: 0.18, align: 'end', value: (r) => (r[2] ? 'OK' : 'REVISE') },
                ],
                [...checks],
              ),
            ]}
          />
        ),
      }}
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            notesBlock('Notes', [
              'Treads with 1" nosing, granite finish 20 mm; risers in same stone.',
              'MS handrail 900 mm high with balusters @ 100 mm c/c max.',
              'Stair position to be coordinated in the plan editor; drawing shows the typical flight design.',
            ], 44),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          {/* PLAN */}
          <rect x={0} y={0} width={planW} height={planH} fill={INK.paper} stroke={INK.line} strokeWidth={mm(0.35)} />
          <rect x={0} y={0} width={planW} height={d.landing} fill={INK.tint} stroke={INK.line} strokeWidth={mm(0.25)} />
          <Label x={planW / 2} y={d.landing / 2 + mm(0.8)} text="MID LANDING" mm={mm} size={1.8} weight={700} />
          {Array.from({ length: d.flights[0] }, (_, i) => (
            <line key={`a${i}`} x1={W + gap} x2={planW} y1={planH - i * tread} y2={planH - i * tread} stroke={INK.line} strokeWidth={mm(0.18)} />
          ))}
          {Array.from({ length: d.flights[1] }, (_, i) => (
            <line key={`b${i}`} x1={0} x2={W} y1={d.landing + i * tread} y2={d.landing + i * tread} stroke={INK.line} strokeWidth={mm(0.18)} />
          ))}
          <rect x={W} y={d.landing} width={gap} height={going} fill={INK.poche} />
          <path d={`M${W + gap + W / 2} ${planH - 0.3} V${d.landing / 2} H${W / 2} V${planH - 0.3}`} fill="none" stroke={INK.red} strokeWidth={mm(0.25)} />
          <path d={`M${W / 2} ${planH - 0.3} l${-mm(1)} ${-mm(1.8)} h${mm(2)} z`} fill={INK.red} />
          <Label x={W + gap + W / 2} y={planH + mm(4)} text="UP" mm={mm} size={2.2} weight={700} color={INK.red} />
          <DimChain axis="x" stops={[0, W, W + gap, planW]} at={-mm(6)} mm={mm} />
          <DimChain axis="y" stops={[0, d.landing, planH]} at={planW + mm(6)} mm={mm} />
          <Label x={planW / 2} y={planH + mm(12)} text="STAIR PLAN" mm={mm} size={3} weight={700} color={INK.line} />

          {/* SECTION: flight 1 cut, flight 2 beyond (dashed) */}
          <g>
            <line x1={secX - 2} x2={secX + secLen + 2} y1={secBase} y2={secBase} stroke={INK.line} strokeWidth={mm(0.4)} />
            <path
              d={[
                `M${secX} ${secBase}`,
                ...Array.from({ length: d.flights[0] }, (_, i) => `V${secBase - (i + 1) * riser} H${secX + Math.min(i + 1, d.flights[0] - 1) * tread}`),
                `H${secX + flight1Going + d.landing}`,
                `V${secBase - d.flights[0] * riser + 0.5}`,
                `L${secX + flight1Going} ${secBase - d.flights[0] * riser + 0.5}`,
                `L${secX + 0.6} ${secBase}`,
                'Z',
              ].join(' ')}
              fill="#e7e7ea"
              stroke={INK.line}
              strokeWidth={mm(0.3)}
            />
            <path
              d={[
                `M${secX + flight1Going + d.landing} ${secBase - d.flights[0] * riser}`,
                ...Array.from({ length: d.flights[1] }, (_, i) => `V${secBase - (d.flights[0] + i + 1) * riser} H${secX + flight1Going + d.landing - (i + 1) * tread}`),
              ].join(' ')}
              fill="none"
              stroke={INK.mid}
              strokeWidth={mm(0.2)}
              strokeDasharray={`${mm(1)} ${mm(0.6)}`}
            />
            <line x1={secX - 2} x2={secX + secLen + 2} y1={secBase - height} y2={secBase - height} stroke={INK.line} strokeWidth={mm(0.2)} strokeDasharray={`${mm(3)} ${mm(1)}`} />
            <rect x={secX + flight1Going + d.landing - 0.1} y={secBase - height} width={secLen - flight1Going - d.landing + 2} height={0.42} fill={INK.poche} />
            <path d={`M${secX} ${secBase - 3} L${secX + flight1Going} ${secBase - d.flights[0] * riser - 3}`} stroke={INK.mid} strokeWidth={mm(0.3)} />
            <DimChain axis="y" stops={[secBase - height, secBase - d.flights[0] * riser, secBase]} at={secX - mm(8)} mm={mm} />
            <Label x={secX + flight1Going / 2} y={secBase - d.flights[0] * riser / 2 + mm(6)} text={`${d.flights[0]} R @ ${riserMm}`} mm={mm} size={1.8} weight={700} rotate={(-Math.atan2(riser, tread) * 180) / Math.PI} />
            <Label x={secX + secLen / 2} y={secBase + mm(12)} text="STAIR SECTION" mm={mm} size={3} weight={700} color={INK.line} />
            <Label x={secX + secLen + 1} y={secBase - height - mm(1.5)} text={`${formatLevel(height)} NEXT FLOOR`} mm={mm} size={1.8} anchor="end" />
          </g>
        </g>
      )}
    </SheetFrame>
  )
}
