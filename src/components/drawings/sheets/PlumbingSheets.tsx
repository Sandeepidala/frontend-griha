import { type FloorModel, type PlanRoom, EXTERIOR_WALL, PARTITION_WALL, center, expand, formatFeet, formatLevel, frontSide, unionRect } from '@/lib/drawings/geometry'
import { type PlacedItem, PLUMBING_FIXTURES } from '@/lib/drawings/interior'
import { drainagePlan, pathLength, waterSupplyPlan } from '@/lib/drawings/services'
import type { DrawingSet } from '@/lib/drawings/sheets'
import { INK, SheetFrame, Stack, legendBlock, notesBlock, tableBlock } from '../SheetFrame'
import { DimChain, ItemSymbol, Label, OpeningSymbol, PIPE_STYLE, PlanBase, Pipe, Tag } from '../symbols'
import { ENGINEER_NOTE, type SheetProps, padBounds, sheetFloor, sheetMeta } from './common'

function fixturesOf(set: DrawingSet, model: FloorModel): PlacedItem[] {
  return (set.items.get(model.floor.id) ?? []).filter((i) => PLUMBING_FIXTURES.includes(i.kind))
}

function pipeLegend(kinds: (keyof typeof PIPE_STYLE)[], labels: Record<string, string>) {
  return kinds.map((k) => ({
    label: labels[k],
    symbol: <line x1={-3} x2={3} y1={0} y2={0} stroke={PIPE_STYLE[k].color} strokeWidth={PIPE_STYLE[k].width} strokeDasharray={PIPE_STYLE[k].dash?.join(' ')} />,
  }))
}

export function WaterSupplySheet(props: SheetProps) {
  const { set, sheet } = props
  const model = sheetFloor(props)
  const items = set.items.get(model.floor.id) ?? []
  const plan = waterSupplyPlan(model, items)
  const fixtures = fixturesOf(set, model)
  const fp = model.footprint
  const span = fp ? Math.max(fp.width, fp.height) : 30
  const bounds = padBounds(fp, span * 0.12 + 3, { x: 0, y: 0, width: set.plot.width, height: set.plot.height })
  const length = (kind: 'cold' | 'hot', label?: string) =>
    Math.round(plan.runs.filter((r) => r.kind === kind && (!label || r.label === label)).reduce((s, r) => s + pathLength(r.points), 0))
  const count = (k: PlacedItem['kind']) => fixtures.filter((f) => f.kind === k).length
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: model.floor.name, note: ENGINEER_NOTE })}
      bounds={bounds}
      northArrow
      aside={{
        width: 88,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Pipe schedule',
                [
                  { title: 'LINE', width: 0.36, value: (r: string[]) => r[0] },
                  { title: 'MATERIAL', width: 0.3, value: (r: string[]) => r[1] },
                  { title: 'DIA', width: 0.16, value: (r: string[]) => r[2] },
                  { title: 'RFT', width: 0.18, align: 'end', value: (r: string[]) => r[3] },
                ],
                [
                  ['Down-take from OHT', 'CPVC SDR 11', '32Ø', '—'],
                  ['Cold water branch', 'CPVC SDR 11', '25Ø', String(length('cold', '25Ø CPVC'))],
                  ['Cold water to fixture', 'CPVC SDR 11', '15Ø', String(length('cold', '15Ø'))],
                  ['Hot water', 'CPVC SDR 11', '15Ø', String(length('hot'))],
                ],
              ),
              tableBlock(
                'Fixtures served',
                [
                  { title: 'FIXTURE', width: 0.7, value: (r: string[]) => r[0] },
                  { title: 'NOS', width: 0.3, align: 'end', value: (r: string[]) => r[1] },
                ],
                [
                  ['EWC (with health faucet)', String(count('wc'))],
                  ['Wash basin (hot + cold)', String(count('basin'))],
                  ['Shower mixer (hot + cold)', String(count('shower'))],
                  ['Kitchen sink (+ RO point)', String(count('sink'))],
                  ['Geyser 25 L', String(plan.heaters.length)],
                ],
              ),
              notesBlock('Notes', [
                'Overhead tank 2000 L on terrace; sump 6000 L at ground with 1 HP pump and auto controller.',
                'Pipes concealed in wall chases, pressure tested at 1.5× working pressure for 2 hours.',
                'Provide ball valve at each toilet/kitchen entry for isolation.',
              ], 50),
            ]}
          />
        ),
      }}
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            legendBlock('Legend', [
              ...pipeLegend(['cold', 'hot'], { cold: 'Cold water line', hot: 'Hot water line' }),
              { label: 'Down-take (riser) from OHT', symbol: <circle r={1.4} fill={INK.cold} stroke={INK.line} strokeWidth={0.2} /> },
              { label: 'Geyser', symbol: <circle r={1.4} fill={INK.redSoft} stroke={INK.hot} strokeWidth={0.25} /> },
            ]),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <PlanBase model={model} mm={mm} muted labels="name" />
          {fixtures.map((f) => (
            <ItemSymbol key={f.id} item={f} mm={mm} />
          ))}
          {plan.runs.map((r) => (
            <Pipe key={r.id} run={r} mm={mm} />
          ))}
          {plan.heaters.map((h, i) => (
            <g key={i}>
              <circle cx={h.x} cy={h.y} r={mm(1.4)} fill={INK.redSoft} stroke={INK.hot} strokeWidth={mm(0.25)} />
              <Label x={h.x} y={h.y + mm(0.7)} text="G" mm={mm} size={1.6} weight={700} color={INK.hot} />
            </g>
          ))}
          {plan.riser && (
            <g>
              <circle cx={plan.riser.x} cy={plan.riser.y} r={mm(1.6)} fill={INK.cold} stroke={INK.line} strokeWidth={mm(0.2)} />
              <Label x={plan.riser.x} y={plan.riser.y - mm(2.6)} text="DT 32Ø FROM OHT" mm={mm} size={1.6} weight={700} color={INK.cold} />
            </g>
          )}
          {!plan.riser && <Label x={bounds.x + bounds.width / 2} y={bounds.y + mm(10)} text="NO PLUMBING FIXTURES ON THIS FLOOR" mm={mm} size={2.4} color={INK.faint} />}
        </g>
      )}
    </SheetFrame>
  )
}

export function DrainageSheet(props: SheetProps) {
  const { set, sheet } = props
  const model = sheetFloor(props)
  const items = set.items.get(model.floor.id) ?? []
  // Stacks from upper floors drop to the lowest-floor chamber ring.
  const upperStacks = model.isLowest
    ? set.models.slice(1).flatMap((m) => drainagePlan(m, set.items.get(m.floor.id) ?? [], [], frontSide(set.plot)).stacks)
    : []
  const plan = drainagePlan(model, items, upperStacks, frontSide(set.plot))
  const fixtures = fixturesOf(set, model)
  const fp = model.footprint
  const extent = unionRect([...(fp ? [expand(fp, 3)] : []), ...(plan.outfall ? [{ ...plan.outfall, width: 0.1, height: 0.1 }] : [])])
  const span = extent ? Math.max(extent.width, extent.height) : 30
  const bounds = padBounds(extent, span * 0.08 + 3, { x: 0, y: 0, width: set.plot.width, height: set.plot.height })
  const lengthOf = (kind: 'soil' | 'waste', label?: string) =>
    Math.round(plan.runs.filter((r) => r.kind === kind && (!label || r.label?.startsWith(label))).reduce((s, r) => s + pathLength(r.points), 0))
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: model.floor.name, note: ENGINEER_NOTE })}
      bounds={bounds}
      northArrow
      aside={{
        width: 88,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              ...(plan.chambers.length
                ? [
                    tableBlock(
                      'Chamber schedule',
                      [
                        { title: 'MARK', width: 0.16, value: (c: (typeof plan.chambers)[number]) => c.label },
                        { title: 'SIZE', width: 0.28, value: (c) => (c.kind === 'mh' ? "3'×3' MH" : "2'×2' IC") },
                        { title: 'INVERT', width: 0.28, align: 'end', value: (c) => formatLevel(c.invert) },
                        { title: 'DEPTH', width: 0.28, align: 'end', value: (c) => formatFeet(Math.abs(c.invert) + 0.5) },
                      ],
                      plan.chambers,
                    ),
                  ]
                : []),
              tableBlock(
                'Pipe schedule',
                [
                  { title: 'LINE', width: 0.4, value: (r: string[]) => r[0] },
                  { title: 'PIPE', width: 0.4, value: (r: string[]) => r[1] },
                  { title: 'RFT', width: 0.2, align: 'end', value: (r: string[]) => r[2] },
                ],
                [
                  ['Soil (WC) branches', 'UPVC SWR 110Ø', String(lengthOf('soil', '100'))],
                  ['Waste branches', 'UPVC SWR 75Ø', String(lengthOf('waste'))],
                  ['External sewer', 'SW / UPVC 150Ø', String(lengthOf('soil', '150'))],
                  ['Soil / vent stacks', 'UPVC SWR 110Ø', `${plan.stacks.length} nos`],
                ],
              ),
              notesBlock('Notes', [
                'Two-pipe system: soil and waste separate up to the inspection chamber.',
                'External sewer laid at 1:40 min. gradient; chambers at every junction/change of direction.',
                'Vent pipes 75Ø extended 3\'-0" above terrace with cowl.',
                'Invert levels relative to FFL ±0\'-0".',
              ], 50),
            ]}
          />
        ),
      }}
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            legendBlock('Legend', [
              ...pipeLegend(['soil', 'waste'], { soil: 'Soil / sewer line', waste: 'Waste line' }),
              { label: 'Inspection chamber', symbol: <rect x={-1.6} y={-1.6} width={3.2} height={3.2} fill={INK.paper} stroke={INK.soil} strokeWidth={0.3} /> },
              { label: 'Manhole to municipal sewer', symbol: <rect x={-2} y={-2} width={4} height={4} fill={INK.soil} /> },
              { label: 'Soil/vent stack (SVP)', symbol: <circle r={1.3} fill={INK.paper} stroke={INK.soil} strokeWidth={0.4} /> },
            ]),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <PlanBase model={model} mm={mm} muted labels="name" />
          {fixtures.map((f) => (
            <ItemSymbol key={f.id} item={f} mm={mm} />
          ))}
          {plan.runs.map((r) => (
            <Pipe key={r.id} run={r} mm={mm} arrow={r.id.startsWith('sw') || r.id.startsWith('dr')} />
          ))}
          {plan.stacks.map((s, i) => (
            <g key={i}>
              <circle cx={s.x} cy={s.y} r={mm(1.3)} fill={INK.paper} stroke={INK.soil} strokeWidth={mm(0.4)} />
              <Label x={s.x} y={s.y - mm(2.2)} text={model.isLowest ? 'SVP FROM ABOVE' : 'SVP 110Ø'} mm={mm} size={1.4} weight={700} color={INK.soil} />
            </g>
          ))}
          {plan.chambers.map((c) => (
            <g key={c.id}>
              {c.kind === 'mh' ? (
                <rect x={c.x - 1.5} y={c.y - 1.5} width={3} height={3} fill={INK.soil} />
              ) : (
                <rect x={c.x - 1} y={c.y - 1} width={2} height={2} fill={INK.paper} stroke={INK.soil} strokeWidth={mm(0.3)} />
              )}
              <Tag x={c.x + 2.4} y={c.y - 1.6} text={c.label} mm={mm} shape="box" size={1.4} color={INK.soil} />
              <Label x={c.x + 2.4} y={c.y + mm(2)} text={`IL ${formatLevel(c.invert)}`} mm={mm} size={1.3} anchor="middle" color={INK.soil} />
            </g>
          ))}
          {plan.outfall && <Label x={plan.outfall.x} y={plan.outfall.y + mm(5)} text="TO MUNICIPAL SEWER" mm={mm} size={1.6} weight={700} color={INK.soil} />}
        </g>
      )}
    </SheetFrame>
  )
}

interface WetDetail {
  model: FloorModel
  room: PlanRoom
  items: PlacedItem[]
}

export function SanitarySheet(props: SheetProps) {
  const { set, sheet } = props
  const details: WetDetail[] = set.models.flatMap((model) =>
    model.rooms
      .filter((r) => r.type === 'wet')
      .map((room) => ({ model, room, items: (set.items.get(model.floor.id) ?? []).filter((i) => i.roomId === room.id) })),
  )
  const perRow = details.length <= 2 ? details.length || 1 : details.length <= 4 ? 2 : 3
  const cellW = Math.max(12, ...details.map((d) => d.room.width)) + 14
  const cellH = Math.max(12, ...details.map((d) => d.room.height)) + 16
  const rows = Math.max(1, Math.ceil(details.length / perRow))
  const bounds = { x: -2, y: -2, width: cellW * perRow + 4, height: cellH * rows + 4 }
  const all = details.flatMap((d) => d.items)
  const count = (k: PlacedItem['kind']) => all.filter((i) => i.kind === k).length
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: 'Toilet details' })}
      bounds={bounds}
      aside={{
        width: 94,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Sanitary fixture schedule',
                [
                  { title: 'FIXTURE', width: 0.3, value: (r: string[]) => r[0] },
                  { title: 'SPECIFICATION', width: 0.56, value: (r: string[]) => r[1] },
                  { title: 'NOS', width: 0.14, align: 'end', value: (r: string[]) => r[2] },
                ],
                [
                  ['EWC', 'Wall-hung, concealed cistern, soft-close seat', String(count('wc'))],
                  ['Health faucet', 'CP brass with angle valve', String(count('wc'))],
                  ['Wash basin', 'Counter-top / wall-hung, pillar tap', String(count('basin'))],
                  ['Shower', 'Thermostatic diverter + overhead shower', String(count('shower'))],
                  ['Floor trap', '100Ø anti-cockroach grating', String(details.length)],
                  ['Accessories', 'Towel rail, soap dish, mirror', `${details.length} sets`],
                ],
              ),
              notesBlock('Finishes', [
                'Floor: anti-skid vitrified tiles 600×600, 1:100 slope to floor trap.',
                'Walls: glazed ceramic dado to 7\'-0" (full height in shower).',
                'Waterproofing: polymer-modified cementitious coating, 12" up the walls, 6\' in shower.',
                'Sunken slab filled with brickbat, drain pipes concealed.',
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
              { label: 'Shower area (sloped to trap)', symbol: <rect x={-2} y={-2} width={4} height={4} fill={INK.coldSoft} stroke={INK.mid} strokeWidth={0.2} /> },
              { label: 'Floor trap', symbol: <circle r={1} fill={INK.paper} stroke={INK.line} strokeWidth={0.3} /> },
              { label: 'Slope direction', symbol: <path d="M-3 0 H2 M2 0 l-1.2 -0.8 v1.6 z" stroke={INK.cold} strokeWidth={0.3} fill={INK.cold} /> },
            ]),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          {details.length === 0 && <Label x={bounds.width / 2} y={bounds.height / 2} text="NO TOILETS IN THE PLAN" mm={mm} size={3} color={INK.faint} />}
          {details.map((d, i) => {
            const col = i % perRow
            const row = Math.floor(i / perRow)
            const ox = col * cellW + 8 - d.room.x
            const oy = row * cellH + 8 - d.room.y
            const r = d.room
            const trap = d.items.find((it) => it.kind === 'shower')
            const tp = trap ? center(trap) : center(r)
            const openings = d.model.openings.filter((o) => o.roomIds.includes(r.id))
            const t = PARTITION_WALL
            return (
              <g key={`${d.model.floor.id}-${r.id}`} transform={`translate(${ox} ${oy})`}>
                <rect x={r.x - EXTERIOR_WALL / 2} y={r.y - EXTERIOR_WALL / 2} width={r.width + EXTERIOR_WALL} height={r.height + EXTERIOR_WALL} fill={INK.poche} />
                <rect x={r.x} y={r.y} width={r.width} height={r.height} fill={INK.paper} />
                {openings.map((o) => {
                  const a0 = o.center - o.width / 2
                  const gap =
                    o.wall.orientation === 'h'
                      ? { x: a0, y: o.wall.at - EXTERIOR_WALL / 2 - 0.05, width: o.width, height: EXTERIOR_WALL + 0.1 }
                      : { x: o.wall.at - EXTERIOR_WALL / 2 - 0.05, y: a0, width: EXTERIOR_WALL + 0.1, height: o.width }
                  return (
                    <g key={o.id}>
                      <rect {...gap} fill={INK.paper} />
                      <OpeningSymbol opening={{ ...o, wall: { ...o.wall, exterior: false, thickness: t * 2 } }} mm={mm} />
                    </g>
                  )
                })}
                {d.items.map((it) => (
                  <ItemSymbol key={it.id} item={it} mm={mm} color={INK.line} />
                ))}
                <circle cx={tp.x} cy={tp.y} r={0.3} fill={INK.paper} stroke={INK.line} strokeWidth={mm(0.25)} />
                {[
                  { x: r.x + r.width * 0.25, y: r.y + r.height * 0.5 },
                  { x: r.x + r.width * 0.75, y: r.y + r.height * 0.3 },
                ].map((p, j) => {
                  const ang = Math.atan2(tp.y - p.y, tp.x - p.x)
                  const len = mm(5)
                  const e = { x: p.x + Math.cos(ang) * len, y: p.y + Math.sin(ang) * len }
                  return (
                    <g key={j}>
                      <line x1={p.x} y1={p.y} x2={e.x} y2={e.y} stroke={INK.cold} strokeWidth={mm(0.2)} />
                      <circle cx={e.x} cy={e.y} r={mm(0.5)} fill={INK.cold} />
                    </g>
                  )
                })}
                <DimChain axis="x" stops={[r.x, r.x + r.width]} at={r.y - mm(7)} mm={mm} />
                <DimChain axis="y" stops={[r.y, r.y + r.height]} at={r.x - mm(7)} mm={mm} />
                <Label x={r.x + r.width / 2} y={r.y + r.height + mm(8)} text={`${r.name.toUpperCase()} — ${d.model.floor.name.toUpperCase()}`} mm={mm} size={2.4} weight={700} color={INK.line} />
                <Label x={r.x + r.width / 2} y={r.y + r.height + mm(11.5)} text="ENLARGED PLAN" mm={mm} size={1.7} />
              </g>
            )
          })}
        </g>
      )}
    </SheetFrame>
  )
}
