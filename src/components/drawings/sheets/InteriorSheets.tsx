import type { ReactNode } from 'react'
import { type PlanRoom, type Side, EXTERIOR_WALL, area, center, formatFeet, formatLevel } from '@/lib/drawings/geometry'
import { type PlacedItem, ITEM_LABEL, ceilingPlan } from '@/lib/drawings/interior'
import { INK, SheetFrame, Stack, legendBlock, notesBlock, tableBlock } from '../SheetFrame'
import { DimChain, ItemSymbol, Label, OpeningSymbol, PlanBase } from '../symbols'
import { type SheetProps, padBounds, sheetFloor, sheetMeta, swatch } from './common'

type Mm = (v: number) => number

export function FurnitureSheet(props: SheetProps) {
  const { set, sheet } = props
  const model = sheetFloor(props)
  const items = set.items.get(model.floor.id) ?? []
  const fp = model.footprint
  const span = fp ? Math.max(fp.width, fp.height) : 30
  const bounds = padBounds(fp, span * 0.1 + 3, { x: 0, y: 0, width: set.plot.width, height: set.plot.height })
  const groups = new Map<string, { room: string; label: string; size: string; qty: number }>()
  for (const item of items) {
    const room = model.rooms.find((r) => r.id === item.roomId)?.name ?? '—'
    const w = Math.min(item.width, item.height)
    const l = Math.max(item.width, item.height)
    const size = `${formatFeet(l)}×${formatFeet(w)}`
    const key = `${room}|${item.label}|${size}`
    const g = groups.get(key)
    if (g) g.qty++
    else groups.set(key, { room, label: item.label, size, qty: 1 })
  }
  const rows = [...groups.values()]
  const custom = items.filter((i) => i.custom).length
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: model.floor.name })}
      bounds={bounds}
      northArrow
      aside={{
        width: 96,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Furniture schedule',
                [
                  { title: 'ROOM', width: 0.3, value: (r: (typeof rows)[number]) => r.room },
                  { title: 'ITEM', width: 0.34, value: (r) => r.label },
                  { title: 'SIZE', width: 0.26, value: (r) => r.size },
                  { title: 'QTY', width: 0.1, align: 'end', value: (r) => String(r.qty) },
                ],
                rows.slice(0, 44),
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
            notesBlock('Notes', [
              custom
                ? `${custom} item(s) placed in the editor are shown as drawn; other rooms use the suggested layout.`
                : 'Suggested layout generated from room use, door swings and windows — adjust in the editor.',
              'Maintain 3\'-0" clear circulation around beds and dining.',
              'Wardrobes 2\'-0" deep, 7\'-0" high with loft above.',
              'Loose furniture sizes are nominal; verify with vendor catalogue.',
            ], 44),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <PlanBase model={model} mm={mm} labels="name" />
          {items.map((item) => (
            <ItemSymbol key={item.id} item={item} mm={mm} />
          ))}
        </g>
      )}
    </SheetFrame>
  )
}

// ---------------------------------------------------------------------------------------------
// Kitchen
// ---------------------------------------------------------------------------------------------

/** Maps plan positions on a wall to elevation u, as seen standing in the room facing it. */
function wallU(room: PlanRoom, side: Side) {
  switch (side) {
    case 'N':
      return { length: room.width, u: (x: number, _y: number) => x - room.x }
    case 'S':
      return { length: room.width, u: (x: number, _y: number) => room.x + room.width - x }
    case 'E':
      return { length: room.height, u: (_x: number, y: number) => y - room.y }
    case 'W':
      return { length: room.height, u: (_x: number, y: number) => room.y + room.height - y }
  }
}

function spanU(item: { x: number; y: number; width: number; height: number }, map: ReturnType<typeof wallU>): [number, number] {
  const a = map.u(item.x, item.y)
  const b = map.u(item.x + item.width, item.y + item.height)
  return [Math.min(a, b), Math.max(a, b)]
}

function KitchenElevation({ room, items, openings, side, ox, oy, mm }: { room: PlanRoom; items: PlacedItem[]; openings: ReturnType<typeof sheetFloor>['openings']; side: Side; ox: number; oy: number; mm: Mm }) {
  const map = wallU(room, side)
  const H = room.room.wallHeight
  const L = map.length
  const X = (u: number) => ox + u
  const Y = (z: number) => oy - z
  const counter = items.find((i) => i.kind === 'counter' && i.wall === side)
  const [c0, c1] = counter ? spanU(counter, map) : [0, L]
  const sink = items.find((i) => i.kind === 'sink' && i.wall === side)
  const hob = items.find((i) => i.kind === 'hob' && i.wall === side)
  const windows = openings.filter(
    (o) =>
      !(o.kind === 'door' || o.kind === 'main-door') &&
      o.roomIds.includes(room.id) &&
      ((side === 'N' && o.wall.orientation === 'h' && Math.abs(o.wall.at - room.y) < 0.05) ||
        (side === 'S' && o.wall.orientation === 'h' && Math.abs(o.wall.at - room.y - room.height) < 0.05) ||
        (side === 'W' && o.wall.orientation === 'v' && Math.abs(o.wall.at - room.x) < 0.05) ||
        (side === 'E' && o.wall.orientation === 'v' && Math.abs(o.wall.at - room.x - room.width) < 0.05)),
  )
  const windowU = windows.map((o) => {
    const p = o.wall.orientation === 'h' ? { x: o.center, y: o.wall.at } : { x: o.wall.at, y: o.center }
    const uc = map.u(p.x, p.y)
    return { u0: uc - o.width / 2, u1: uc + o.width / 2, z0: o.sill, z1: o.sill + o.height }
  })
  const hobU = hob ? spanU(hob, map) : null
  const sinkU = sink ? spanU(sink, map) : null
  // Wall cabinets, broken around windows and the chimney.
  const blocks: [number, number][] = []
  const gaps = [...windowU.map((w) => [w.u0 - 0.2, w.u1 + 0.2] as [number, number]), ...(hobU ? [[hobU[0] - 0.2, hobU[1] + 0.2] as [number, number]] : [])].sort((a, b) => a[0] - b[0])
  let cursor = c0
  for (const [g0, g1] of gaps) {
    if (g0 > cursor + 1) blocks.push([cursor, Math.min(g0, c1)])
    cursor = Math.max(cursor, g1)
  }
  if (c1 > cursor + 1) blocks.push([cursor, c1])
  const shutters = (a: number, b: number, z0: number, z1: number, key: string) => {
    const n = Math.max(1, Math.round((b - a) / 1.6))
    const out: ReactNode[] = []
    for (let i = 0; i < n; i++) {
      const u = a + ((b - a) * i) / n
      const w = (b - a) / n
      out.push(<rect key={`${key}${i}`} x={X(u) + 0.05} y={Y(z1) + 0.05} width={w - 0.1} height={z1 - z0 - 0.1} fill={INK.paper} stroke={INK.mid} strokeWidth={mm(0.15)} />)
      out.push(<line key={`${key}h${i}`} x1={X(u + (i % 2 ? 0.2 : w - 0.2))} x2={X(u + (i % 2 ? 0.2 : w - 0.2))} y1={Y(z1 - 0.4)} y2={Y(z1 - 0.9)} stroke={INK.line} strokeWidth={mm(0.3)} />)
    }
    return out
  }
  return (
    <g>
      <rect x={X(0)} y={Y(H)} width={L} height={H} fill={INK.paper} stroke={INK.line} strokeWidth={mm(0.35)} />
      <rect x={X(c0)} y={Y(5)} width={c1 - c0} height={5 - 2.92} fill="url(#hatch-diag)" opacity={0.5} />
      {windowU.map((w, i) => (
        <g key={i}>
          <rect x={X(w.u0)} y={Y(w.z1)} width={w.u1 - w.u0} height={w.z1 - w.z0} fill={INK.coldSoft} stroke={INK.line} strokeWidth={mm(0.3)} />
          <line x1={X((w.u0 + w.u1) / 2)} x2={X((w.u0 + w.u1) / 2)} y1={Y(w.z1)} y2={Y(w.z0)} stroke={INK.line} strokeWidth={mm(0.15)} />
        </g>
      ))}
      {shutters(c0, c1, 0.33, 2.75, 'b')}
      <rect x={X(c0)} y={Y(0.33)} width={c1 - c0} height={0.33} fill={INK.tint} stroke={INK.mid} strokeWidth={mm(0.12)} />
      <rect x={X(c0) - 0.05} y={Y(2.92)} width={c1 - c0 + 0.1} height={0.17} fill={INK.poche} />
      {blocks.map(([a, b], i) => (
        <g key={i}>{shutters(a, b, 5, 7.25, `w${i}`)}</g>
      ))}
      {sinkU && <rect x={X(sinkU[0])} y={Y(2.92)} width={sinkU[1] - sinkU[0]} height={0.5} fill={INK.faint} />}
      {sinkU && <path d={`M${X((sinkU[0] + sinkU[1]) / 2)} ${Y(2.92)} v${-0.9} h0.5`} fill="none" stroke={INK.line} strokeWidth={mm(0.35)} />}
      {hobU && (
        <g>
          <rect x={X(hobU[0])} y={Y(3.05)} width={hobU[1] - hobU[0]} height={0.13} fill={INK.line} />
          <path d={`M${X(hobU[0]) - 0.1} ${Y(6.4)} L${X(hobU[0]) + 0.5} ${Y(7.1)} H${X(hobU[1]) - 0.5} L${X(hobU[1]) + 0.1} ${Y(6.4)} Z`} fill={INK.tint} stroke={INK.line} strokeWidth={mm(0.3)} />
          <rect x={X((hobU[0] + hobU[1]) / 2) - 0.45} y={Y(H)} width={0.9} height={H - 7.1} fill={INK.tint} stroke={INK.line} strokeWidth={mm(0.25)} />
          <Label x={X((hobU[0] + hobU[1]) / 2)} y={Y(6.4) + mm(3)} text="CHIMNEY 60cm" mm={mm} size={1.5} />
        </g>
      )}
      <line x1={X(-1)} x2={X(L + 1)} y1={Y(0)} y2={Y(0)} stroke={INK.line} strokeWidth={mm(0.5)} />
      <DimChain axis="y" stops={[Y(0), Y(2.92), Y(5), Y(7.25), Y(H)]} at={X(L) + mm(8)} mm={mm} />
      <DimChain axis="x" stops={[X(0), X(c0), X(c1), X(L)].filter((v, i, a) => a.indexOf(v) === i)} at={Y(0) + mm(6)} mm={mm} />
      <Label x={X(c0) + 0.4} y={Y(1.6)} text="BASE UNITS" mm={mm} size={1.5} anchor="start" />
      <Label x={X(c0) + 0.4} y={Y(4.1)} text="DADO TILES" mm={mm} size={1.5} anchor="start" />
      {blocks[0] && <Label x={X(blocks[0][0]) + 0.4} y={Y(6.2)} text="WALL UNITS" mm={mm} size={1.5} anchor="start" />}
      <Label x={X(L / 2)} y={Y(0) + mm(14)} text={`ELEVATION — ${side === 'N' ? 'NORTH' : side === 'S' ? 'SOUTH' : side === 'E' ? 'EAST' : 'WEST'} WALL`} mm={mm} size={2.6} weight={700} color={INK.line} />
    </g>
  )
}

export function KitchenSheet(props: SheetProps) {
  const { set, sheet } = props
  const found = set.models.flatMap((model) => model.rooms.filter((r) => r.type === 'kitchen').map((room) => ({ model, room })))
  const target = found.find((k) => k.model.floor.id === props.floorId) ?? found[0]
  if (!target) {
    return (
      <SheetFrame meta={sheetMeta(set, sheet)} bounds={{ x: 0, y: 0, width: 30, height: 20 }}>
        {({ mm }) => <Label x={15} y={10} text="NO KITCHEN IN THE PLAN" mm={mm} size={3} color={INK.faint} />}
      </SheetFrame>
    )
  }
  const { model, room } = target
  const items = (set.items.get(model.floor.id) ?? []).filter((i) => i.roomId === room.id)
  const counters = items.filter((i) => i.kind === 'counter').sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height))
  const mainSide: Side = counters[0]?.wall ?? 'N'
  const elevLen = mainSide === 'N' || mainSide === 'S' ? room.width : room.height
  const H = room.room.wallHeight
  const elevY = room.y + room.height + 12 + H
  const openings = model.openings.filter((o) => o.roomIds.includes(room.id))
  const bounds = {
    x: room.x - 8,
    y: room.y - 8,
    width: Math.max(room.width, elevLen) + 20,
    height: room.height + H + 30,
  }
  const sink = items.find((i) => i.kind === 'sink')
  const hob = items.find((i) => i.kind === 'hob')
  const fridge = items.find((i) => i.kind === 'fridge')
  const dist = (a?: PlacedItem, b?: PlacedItem) => (a && b ? Math.hypot(center(a).x - center(b).x, center(a).y - center(b).y) : 0)
  const legs = [dist(sink, hob), dist(hob, fridge), dist(fridge, sink)]
  const perimeter = legs.reduce((s, l) => s + l, 0)
  const counterLength = counters.reduce((s, c) => s + Math.max(c.width, c.height), 0)
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: /^kitchen$/i.test(room.name) ? model.floor.name : `${room.name}, ${model.floor.name}` })}
      bounds={bounds}
      aside={{
        width: 88,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Kitchen specification',
                [
                  { title: 'ELEMENT', width: 0.34, value: (r: string[]) => r[0] },
                  { title: 'SPECIFICATION', width: 0.66, value: (r: string[]) => r[1] },
                ],
                [
                  ['Counter top', '20 mm granite, 2\'-0" deep, 2\'-11" high'],
                  ['Base units', 'BWP ply carcass, laminate shutters'],
                  ['Wall units', "1'-2\" deep, 5'-0\" to 7'-3\" AFL"],
                  ['Sink', 'SS double bowl with drain board'],
                  ['Hob', '4-burner glass top, 60 cm chimney'],
                  ['Dado', "Ceramic tiles 2'-11\" to 5'-0\""],
                  ['Counter length', `${formatFeet(counterLength)} run`],
                  ['Kitchen area', `${Math.round(area(room))} sft`],
                ],
              ),
              tableBlock(
                'Work triangle',
                [
                  { title: 'LEG', width: 0.5, value: (r: string[]) => r[0] },
                  { title: 'LENGTH', width: 0.5, align: 'end', value: (r: string[]) => r[1] },
                ],
                [
                  ['Sink → hob', legs[0] ? formatFeet(legs[0]) : '—'],
                  ['Hob → fridge', legs[1] ? formatFeet(legs[1]) : '—'],
                  ['Fridge → sink', legs[2] ? formatFeet(legs[2]) : '—'],
                  ['Total (12\'–26\' ideal)', perimeter ? `${formatFeet(perimeter)} ${perimeter >= 12 && perimeter <= 26 ? 'OK' : 'REVIEW'}` : '—'],
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
              { label: 'Counter top', symbol: swatch.fill(INK.tint, INK.mid) },
              { label: 'Dado tiles', symbol: swatch.pattern('hatch-diag') },
              { label: 'Window', symbol: swatch.fill(INK.coldSoft) },
            ]),
            notesBlock('Notes', [
              'Provide 16A sockets above counter at 3\'-7" AFL (see E-102).',
              'Sink water supply and waste as per P-101/P-102.',
              'Chimney duct 150Ø to external wall with cowl.',
              ...(found.length > 1 ? [`${found.length - 1} more kitchen(s) follow the same specification.`] : []),
            ], 44),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <rect x={room.x - EXTERIOR_WALL / 2} y={room.y - EXTERIOR_WALL / 2} width={room.width + EXTERIOR_WALL} height={room.height + EXTERIOR_WALL} fill={INK.poche} />
          <rect x={room.x} y={room.y} width={room.width} height={room.height} fill={INK.paper} />
          {openings.map((o) => {
            const a0 = o.center - o.width / 2
            const gap =
              o.wall.orientation === 'h'
                ? { x: a0, y: o.wall.at - EXTERIOR_WALL / 2 - 0.05, width: o.width, height: EXTERIOR_WALL + 0.1 }
                : { x: o.wall.at - EXTERIOR_WALL / 2 - 0.05, y: a0, width: EXTERIOR_WALL + 0.1, height: o.width }
            return (
              <g key={o.id}>
                <rect {...gap} fill={INK.paper} />
                <OpeningSymbol opening={{ ...o, wall: { ...o.wall, exterior: false, thickness: EXTERIOR_WALL } }} mm={mm} />
              </g>
            )
          })}
          {items.map((item) => (
            <ItemSymbol key={item.id} item={item} mm={mm} color={INK.line} />
          ))}
          {items
            .filter((i) => ['sink', 'hob', 'fridge', 'dining'].includes(i.kind))
            .map((i) => (
              <Label key={`l${i.id}`} x={center(i).x} y={center(i).y + (i.kind === 'dining' ? mm(0.6) : -Math.max(i.width, i.height) / 2 - mm(1.5))} text={ITEM_LABEL[i.kind].toUpperCase()} mm={mm} size={1.5} weight={700} color={INK.line} />
            ))}
          {sink && hob && fridge && (
            <path
              d={`M${center(sink).x} ${center(sink).y} L${center(hob).x} ${center(hob).y} L${center(fridge).x} ${center(fridge).y} Z`}
              fill="none"
              stroke={INK.red}
              strokeWidth={mm(0.25)}
              strokeDasharray={`${mm(1.2)} ${mm(0.8)}`}
            />
          )}
          <DimChain axis="x" stops={[room.x, room.x + room.width]} at={room.y - mm(8)} mm={mm} />
          <DimChain axis="y" stops={[room.y, room.y + room.height]} at={room.x - mm(8)} mm={mm} />
          <Label x={room.x + room.width / 2} y={room.y + room.height + mm(8)} text="KITCHEN — ENLARGED PLAN" mm={mm} size={2.6} weight={700} color={INK.line} />
          <KitchenElevation room={room} items={items} openings={model.openings} side={mainSide} ox={room.x} oy={elevY} mm={mm} />
        </g>
      )}
    </SheetFrame>
  )
}

// ---------------------------------------------------------------------------------------------
// False ceiling (reflected ceiling plan)
// ---------------------------------------------------------------------------------------------

const CEILING_NAME = {
  peripheral: 'Peripheral + cove',
  flat: 'Flat',
  grid: 'Grid',
  feature: 'Feature dome',
  exposed: 'None (slab)',
} as const

export function FalseCeilingSheet(props: SheetProps) {
  const { set, sheet } = props
  const model = sheetFloor(props)
  const zones = ceilingPlan(model)
  const fp = model.footprint
  const span = fp ? Math.max(fp.width, fp.height) : 30
  const bounds = padBounds(fp, span * 0.1 + 3, { x: 0, y: 0, width: set.plot.width, height: set.plot.height })
  const roomOf = (id: string) => model.rooms.find((r) => r.id === id)!
  const lights = zones.reduce((s, z) => s + z.downlights.length, 0)
  const cove = zones.filter((z) => z.coveLight && z.recess).reduce((s, z) => s + 2 * (z.recess!.width + z.recess!.height), 0)
  const gypsum = zones.filter((z) => z.kind !== 'exposed' && z.kind !== 'grid').reduce((s, z) => s + area(roomOf(z.roomId)), 0)
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: `Reflected ceiling plan — ${model.floor.name}` })}
      bounds={bounds}
      northArrow
      aside={{
        width: 96,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Ceiling schedule',
                [
                  { title: 'ROOM', width: 0.28, value: (z: (typeof zones)[number]) => roomOf(z.roomId).name },
                  { title: 'TYPE', width: 0.28, value: (z) => CEILING_NAME[z.kind] },
                  { title: 'LEVEL', width: 0.22, align: 'end', value: (z) => formatLevel(z.level) },
                  { title: 'LIGHTS', width: 0.22, align: 'end', value: (z) => String(z.downlights.length) },
                ],
                zones,
              ),
              tableBlock(
                'Quantities',
                [
                  { title: 'ITEM', width: 0.6, value: (r: string[]) => r[0] },
                  { title: 'QTY', width: 0.4, align: 'end', value: (r: string[]) => r[1] },
                ],
                [
                  ['Gypsum false ceiling', `${Math.round(gypsum)} sft`],
                  ['PVC grid ceiling', `${Math.round(zones.filter((z) => z.kind === 'grid').reduce((s, z) => s + area(roomOf(z.roomId)), 0))} sft`],
                  ['LED cove strip', `${Math.round(cove)} rft`],
                  ['Downlights (12 W)', String(lights)],
                ],
              ),
              notesBlock('Materials', [...new Set(zones.map((z) => `${CEILING_NAME[z.kind]}: ${z.material}`))], 56),
            ]}
          />
        ),
      }}
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            legendBlock('Legend', [
              { label: 'False ceiling band (lower)', symbol: swatch.fill(INK.tint, INK.mid) },
              { label: 'Recessed ceiling (higher)', symbol: swatch.fill(INK.paper, INK.mid) },
              { label: 'Concealed LED cove', symbol: swatch.line(INK.elec, 0.3, '1 0.5') },
              { label: 'Recessed downlight', symbol: <circle r={1.2} fill={INK.paper} stroke={INK.elec} strokeWidth={0.3} /> },
              { label: 'Grid ceiling 2\'×2\'', symbol: <g stroke={INK.faint} strokeWidth={0.2}><rect x={-3} y={-2} width={6} height={4} fill="none" /><path d="M0 -2 V2 M-3 0 H3" /></g> },
            ]),
            notesBlock('Notes', [
              'Levels are underside of false ceiling above FFL.',
              'Provide access panels near AC indoor units and junction boxes.',
              'Coordinate fan hooks and light points with E-101 before boarding.',
            ], 44),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <PlanBase model={model} mm={mm} muted labels="none" showOpenings={false} />
          {zones.map((z) => {
            const r = roomOf(z.roomId)
            const parts: ReactNode[] = []
            if (z.kind === 'peripheral' || z.kind === 'feature') {
              parts.push(<rect key="band" x={r.x} y={r.y} width={r.width} height={r.height} fill={INK.tint} />)
              if (z.recess) {
                if (z.kind === 'feature') {
                  const c = center(z.recess)
                  parts.push(<circle key="rec" cx={c.x} cy={c.y} r={z.recess.width / 2} fill={INK.paper} stroke={INK.mid} strokeWidth={mm(0.25)} />)
                  parts.push(<circle key="cove" cx={c.x} cy={c.y} r={z.recess.width / 2 - 0.25} fill="none" stroke={INK.elec} strokeWidth={mm(0.25)} strokeDasharray={`${mm(1)} ${mm(0.5)}`} />)
                } else {
                  parts.push(<rect key="rec" {...z.recess} fill={INK.paper} stroke={INK.mid} strokeWidth={mm(0.25)} />)
                  parts.push(
                    <rect key="cove" x={z.recess.x + 0.25} y={z.recess.y + 0.25} width={z.recess.width - 0.5} height={z.recess.height - 0.5} fill="none" stroke={INK.elec} strokeWidth={mm(0.25)} strokeDasharray={`${mm(1)} ${mm(0.5)}`} />,
                  )
                }
              }
            } else if (z.kind === 'grid') {
              for (let x = r.x + 2; x < r.x + r.width; x += 2) parts.push(<line key={`gx${x}`} x1={x} x2={x} y1={r.y} y2={r.y + r.height} stroke={INK.faint} strokeWidth={mm(0.12)} />)
              for (let y = r.y + 2; y < r.y + r.height; y += 2) parts.push(<line key={`gy${y}`} x1={r.x} x2={r.x + r.width} y1={y} y2={y} stroke={INK.faint} strokeWidth={mm(0.12)} />)
            } else if (z.kind === 'exposed') {
              parts.push(<rect key="ex" x={r.x} y={r.y} width={r.width} height={r.height} fill="url(#hatch-diag)" opacity={0.35} />)
            }
            for (const [i, p] of z.downlights.entries()) {
              parts.push(<circle key={`dl${i}`} cx={p.x} cy={p.y} r={mm(1)} fill={INK.paper} stroke={INK.elec} strokeWidth={mm(0.3)} />)
            }
            const c = center(r)
            parts.push(
              <g key="tag">
                <rect x={c.x - mm(10)} y={c.y - mm(3.2)} width={mm(20)} height={mm(6.6)} fill={INK.paper} stroke={INK.hair} strokeWidth={mm(0.15)} rx={mm(0.6)} />
                <Label x={c.x} y={c.y - mm(0.5)} text={r.name.toUpperCase()} mm={mm} size={1.5} weight={700} color={INK.line} />
                <Label x={c.x} y={c.y + mm(2.3)} text={z.kind === 'exposed' ? 'NO FALSE CEILING' : `FCL ${formatLevel(z.level)}${z.recessLevel ? ` / ${formatLevel(z.recessLevel)}` : ''}`} mm={mm} size={1.4} color={INK.mid} />
              </g>,
            )
            return <g key={z.roomId}>{parts}</g>
          })}
          {/* Re-draw walls over the ceiling zones so partitions stay crisp. */}
          <PlanBase model={model} mm={mm} muted labels="none" showOpenings={false} roomFill={() => 'none'} />
        </g>
      )}
    </SheetFrame>
  )
}
