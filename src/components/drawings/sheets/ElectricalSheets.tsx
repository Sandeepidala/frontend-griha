import { formatFeet } from '@/lib/drawings/geometry'
import { ELEC_LABEL, type ElecKind, type ElecPoint, electricalPlan, manhattan } from '@/lib/drawings/services'
import { INK, SheetFrame, Stack, type Block, legendBlock, notesBlock, tableBlock } from '../SheetFrame'
import { ElecSymbol, Label, PlanBase, Polyline, WireArc } from '../symbols'
import { ENGINEER_NOTE, type SheetProps, padBounds, sheetFloor, sheetMeta } from './common'

const LIGHTING: ElecKind[] = ['light', 'fan', 'exhaust', 'bell']
const POWER: ElecKind[] = ['socket5', 'socket15', 'ac', 'geyser', 'tv']

function usePlan(props: SheetProps) {
  const model = sheetFloor(props)
  const items = props.set.items.get(model.floor.id) ?? []
  const plan = electricalPlan(model, items)
  const fp = model.footprint
  const span = fp ? Math.max(fp.width, fp.height) : 30
  const bounds = padBounds(fp, span * 0.12 + 3, { x: 0, y: 0, width: props.set.plot.width, height: props.set.plot.height })
  return { model, plan, bounds }
}

function legend(kinds: ElecKind[]): Block {
  return legendBlock(
    'Legend',
    [...kinds, 'switchboard' as ElecKind].map((kind) => ({
      label: ELEC_LABEL[kind],
      symbol: <ElecSymbol kind={kind} x={0} y={0} s={1.4} />,
    })),
  )
}

function Points({ points, kinds, s }: { points: ElecPoint[]; kinds: ElecKind[]; s: number }) {
  return (
    <>
      {points
        .filter((p) => kinds.includes(p.kind))
        .map((p) => (
          <ElecSymbol key={p.id} kind={p.kind} x={p.x} y={p.y} s={s} />
        ))}
    </>
  )
}

function Wiring({ points, switchboards, kinds, mm }: { points: ElecPoint[]; switchboards: Map<string, { x: number; y: number }>; kinds: ElecKind[]; mm: (v: number) => number }) {
  return (
    <>
      {points
        .filter((p) => kinds.includes(p.kind))
        .map((p) => {
          const sb = switchboards.get(p.roomId)
          return sb ? <WireArc key={`w${p.id}`} from={sb} to={p} mm={mm} /> : null
        })}
    </>
  )
}

function roomCounts(model: ReturnType<typeof sheetFloor>, points: ElecPoint[], kinds: ElecKind[]) {
  return model.rooms.map((room) => {
    const own = points.filter((p) => p.roomId === room.id && kinds.includes(p.kind))
    const count = (k: ElecKind) => own.filter((p) => p.kind === k).length
    return { room: room.name, count, watts: own.reduce((s, p) => s + p.watts, 0) }
  })
}

export function LightingSheet(props: SheetProps) {
  const { set, sheet } = props
  const { model, plan, bounds } = usePlan(props)
  const rows = roomCounts(model, plan.points, LIGHTING)
  const total = rows.reduce((s, r) => s + r.watts, 0)
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: model.floor.name, note: ENGINEER_NOTE })}
      bounds={bounds}
      northArrow
      aside={{
        width: 86,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Lighting points',
                [
                  { title: 'ROOM', width: 0.4, value: (r: (typeof rows)[number]) => r.room },
                  { title: 'LT', width: 0.12, align: 'end', value: (r) => String(r.count('light')) },
                  { title: 'FAN', width: 0.13, align: 'end', value: (r) => String(r.count('fan')) },
                  { title: 'EF', width: 0.12, align: 'end', value: (r) => String(r.count('exhaust')) },
                  { title: 'WATTS', width: 0.23, align: 'end', value: (r) => String(r.watts) },
                ],
                rows,
                { footer: ['Total', '', '', '', `${total} W`] },
              ),
              notesBlock('Notes', [
                'LED fittings: 12–18 W downlights, 20 W batten/surface lights; fans BLDC 35–75 W.',
                'Wiring 1.5 sq mm FR-LSH copper in 20 mm PVC conduit, concealed.',
                'Switchboards at 1200 mm AFL on the latch side of doors.',
                'Two-way switching for staircase and bedroom lights near bed.',
              ], 48),
            ]}
          />
        ),
      }}
      side={(box) => <Stack box={box} blocks={[legend(LIGHTING)]} />}
    >
      {({ mm }) => (
        <g>
          <PlanBase model={model} mm={mm} muted labels="name" />
          <Wiring points={plan.points} switchboards={plan.switchboards} kinds={LIGHTING} mm={mm} />
          <Points points={plan.points} kinds={[...LIGHTING, 'switchboard']} s={mm(1.3)} />
        </g>
      )}
    </SheetFrame>
  )
}

export function PowerSheet(props: SheetProps) {
  const { set, sheet } = props
  const { model, plan, bounds } = usePlan(props)
  const rows = roomCounts(model, plan.points, POWER)
  const total = rows.reduce((s, r) => s + r.watts, 0)
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
                'Power points',
                [
                  { title: 'ROOM', width: 0.34, value: (r: (typeof rows)[number]) => r.room },
                  { title: '6A', width: 0.1, align: 'end', value: (r) => String(r.count('socket5')) },
                  { title: '16A', width: 0.11, align: 'end', value: (r) => String(r.count('socket15')) },
                  { title: 'AC', width: 0.1, align: 'end', value: (r) => String(r.count('ac')) },
                  { title: 'GY', width: 0.1, align: 'end', value: (r) => String(r.count('geyser')) },
                  { title: 'WATTS', width: 0.25, align: 'end', value: (r) => String(r.watts) },
                ],
                rows,
                { footer: ['Total', '', '', '', '', `${total} W`] },
              ),
              notesBlock('Notes', [
                '6A sockets at 300 mm AFL; kitchen counter sockets at 1100 mm AFL.',
                '16A circuits 4 sq mm; AC circuits 4 sq mm, one per unit with isolator.',
                'Geyser point at 1800 mm AFL with 20A DP switch outside wet area.',
                'All sockets on RCCB-protected circuits (30 mA).',
              ], 50),
            ]}
          />
        ),
      }}
      side={(box) => <Stack box={box} blocks={[legend(POWER)]} />}
    >
      {({ mm }) => (
        <g>
          <PlanBase model={model} mm={mm} muted labels="name" />
          <Wiring points={plan.points} switchboards={plan.switchboards} kinds={POWER} mm={mm} />
          <Points points={plan.points} kinds={[...POWER, 'switchboard']} s={mm(1.3)} />
        </g>
      )}
    </SheetFrame>
  )
}

function HomeRuns({ model, plan, mm }: { model: ReturnType<typeof sheetFloor>; plan: ReturnType<typeof electricalPlan>; mm: (v: number) => number }) {
  const db = plan.db
  if (!db) return null
  return (
    <>
      {model.rooms.map((room) => {
        const sb = plan.switchboards.get(room.id)
        if (!sb) return null
        const circuits = [...new Set(plan.points.filter((p) => p.roomId === room.id && p.circuit && p.circuit !== 'SB').map((p) => p.circuit))]
        return (
          <g key={room.id}>
            <Polyline points={manhattan(db, sb)} color={INK.elec} width={0.35} mm={mm} />
            {circuits.length > 0 && (
              <text x={sb.x} y={sb.y - mm(2)} fontSize={mm(1.5)} textAnchor="middle" fontWeight={700} fill={INK.elec}>
                {circuits.join(',')}
              </text>
            )}
          </g>
        )
      })}
    </>
  )
}

export function ElectricalLayoutSheet(props: SheetProps) {
  const { set, sheet } = props
  const { model, plan, bounds } = usePlan(props)
  const demand = plan.connectedLoad * 0.6
  const threePhase = demand > 5000
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: model.floor.name, note: ENGINEER_NOTE })}
      bounds={bounds}
      northArrow
      aside={{
        width: 100,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'DB load schedule',
                [
                  { title: 'CKT', width: 0.09, value: (c: (typeof plan.circuits)[number]) => c.id },
                  { title: 'DESCRIPTION', width: 0.47, value: (c) => c.description },
                  { title: 'PTS', width: 0.08, align: 'end', value: (c) => String(c.points) },
                  { title: 'LOAD W', width: 0.14, align: 'end', value: (c) => String(c.watts) },
                  { title: 'MCB', width: 0.12, align: 'end', value: (c) => `${c.mcb}A` },
                  { title: 'PH', width: 0.1, align: 'end', value: (c) => c.phase },
                ],
                plan.circuits,
                { footer: ['', 'Connected load', '', String(plan.connectedLoad), '', ''], fontSize: 1.9 },
              ),
              tableBlock(
                'Supply',
                [
                  { title: 'ITEM', width: 0.55, value: (r: string[]) => r[0] },
                  { title: 'VALUE', width: 0.45, align: 'end', value: (r: string[]) => r[1] },
                ],
                [
                  ['Connected load', `${(plan.connectedLoad / 1000).toFixed(2)} kW`],
                  ['Max demand (0.6 DF)', `${(demand / 1000).toFixed(2)} kW`],
                  ['Supply', threePhase ? '3-phase, 415 V' : '1-phase, 230 V'],
                  ['Incomer', threePhase ? '40A TPN MCB + 63A 4P RCCB' : '40A DP MCB + 63A 2P RCCB'],
                  ['Main cable', threePhase ? '4C × 10 sq mm Cu' : '2C × 10 sq mm Cu'],
                  ['Earthing', '2 nos. pipe/chemical earth pits'],
                ],
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
              { label: ELEC_LABEL.db, symbol: <ElecSymbol kind="db" x={0} y={0} s={1.4} /> },
              { label: 'Home run DB → switchboard', symbol: <line x1={-3} x2={3} y1={0} y2={0} stroke={INK.elec} strokeWidth={0.35} /> },
              { label: 'Point wiring', symbol: <line x1={-3} x2={3} y1={0} y2={0} stroke={INK.elec} strokeWidth={0.15} strokeDasharray="1 0.6" /> },
              { label: 'Lighting / fan points', symbol: <ElecSymbol kind="light" x={0} y={0} s={1.4} /> },
              { label: 'Power points', symbol: <ElecSymbol kind="socket15" x={0} y={0} s={1.4} /> },
            ]),
            notesBlock('Notes', [
              plan.db ? `DB located ${formatFeet(1)} beside the main door, 1800 mm AFL.` : 'Floor DB fed from the ground floor main DB via rising mains.',
              'Circuit IDs shown at each switchboard.',
            ], 44),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <PlanBase model={model} mm={mm} muted labels="name" />
          <Wiring points={plan.points} switchboards={plan.switchboards} kinds={[...LIGHTING, ...POWER]} mm={mm} />
          <HomeRuns model={model} plan={plan} mm={mm} />
          <Points points={plan.points} kinds={[...LIGHTING, ...POWER, 'switchboard', 'db']} s={mm(1.2)} />
          {plan.db && <Label x={plan.db.x} y={plan.db.y + mm(4)} text="DB" mm={mm} size={1.8} weight={700} color={INK.line} />}
        </g>
      )}
    </SheetFrame>
  )
}
