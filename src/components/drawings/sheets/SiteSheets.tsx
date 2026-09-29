import {
  type Rect,
  type Side,
  OUTWARD,
  SETBACK_SIDES,
  areaStatement,
  formatFeet,
  providedSetbacks,
  requiredSetbacks,
} from '@/lib/drawings/geometry'
import type { DrawingSet } from '@/lib/drawings/sheets'
import { COMPOUND, type Site, driveway, gateRect, landscapeLayout, siteContext } from '@/lib/drawings/site'
import { INK, SheetFrame, Stack, legendBlock, notesBlock, tableBlock } from '../SheetFrame'
import { DimChain, Label, PlanBase } from '../symbols'
import { type SheetProps, fmtArea, sheetMeta, swatch } from './common'

function Road({ site, mm }: { site: Site; mm: (v: number) => number }) {
  const { road, horizontalFront } = site
  const cx = road.x + road.width / 2
  const cy = road.y + road.height / 2
  return (
    <g>
      <rect {...road} fill={INK.road} />
      <line
        x1={horizontalFront ? road.x : cx}
        y1={horizontalFront ? cy : road.y}
        x2={horizontalFront ? road.x + road.width : cx}
        y2={horizontalFront ? cy : road.y + road.height}
        stroke={INK.paper}
        strokeWidth={mm(0.6)}
        strokeDasharray={`${mm(5)} ${mm(3)}`}
      />
      <Label x={cx} y={cy - mm(2)} text={`${formatFeet(site.roadWidth)} WIDE ROAD`} mm={mm} size={2.6} weight={700} color={INK.mid} rotate={horizontalFront ? 0 : -90} />
    </g>
  )
}

function CompoundWall({ site, mm }: { site: Site; mm: (v: number) => number }) {
  const { plot } = site
  const gate = gateRect(site)
  const sides: Record<Side, Rect> = {
    N: { x: 0, y: 0, width: plot.width, height: COMPOUND },
    S: { x: 0, y: plot.height - COMPOUND, width: plot.width, height: COMPOUND },
    W: { x: 0, y: 0, width: COMPOUND, height: plot.height },
    E: { x: plot.width - COMPOUND, y: 0, width: COMPOUND, height: plot.height },
  }
  const pieces: Rect[] = []
  for (const side of ['N', 'S', 'E', 'W'] as Side[]) {
    const r = sides[side]
    if (side !== site.front) {
      pieces.push(r)
      continue
    }
    if (site.horizontalFront) {
      pieces.push({ ...r, width: gate.x - r.x })
      pieces.push({ ...r, x: gate.x + gate.width, width: r.x + r.width - gate.x - gate.width })
    } else {
      pieces.push({ ...r, height: gate.y - r.y })
      pieces.push({ ...r, y: gate.y + gate.height, height: r.y + r.height - gate.y - gate.height })
    }
  }
  const leaf = site.horizontalFront ? gate.width / 2 : gate.height / 2
  return (
    <g>
      {pieces.filter((p) => p.width > 0.01 && p.height > 0.01).map((p, i) => (
        <rect key={i} {...p} fill={INK.hatch} stroke={INK.line} strokeWidth={mm(0.12)} />
      ))}
      {/* Twin sliding/swing gate leaves */}
      {site.horizontalFront ? (
        <>
          <line x1={gate.x} y1={gate.y + COMPOUND / 2} x2={gate.x + leaf - 0.2} y2={gate.y + COMPOUND / 2} stroke={INK.line} strokeWidth={mm(0.5)} />
          <line x1={gate.x + leaf + 0.2} y1={gate.y + COMPOUND / 2} x2={gate.x + gate.width} y2={gate.y + COMPOUND / 2} stroke={INK.line} strokeWidth={mm(0.5)} />
        </>
      ) : (
        <>
          <line x1={gate.x + COMPOUND / 2} y1={gate.y} x2={gate.x + COMPOUND / 2} y2={gate.y + leaf - 0.2} stroke={INK.line} strokeWidth={mm(0.5)} />
          <line x1={gate.x + COMPOUND / 2} y1={gate.y + leaf + 0.2} x2={gate.x + COMPOUND / 2} y2={gate.y + gate.height} stroke={INK.line} strokeWidth={mm(0.5)} />
        </>
      )}
      <Label
        x={gate.x + gate.width / 2 + (site.horizontalFront ? 0 : OUTWARD[site.front].x * mm(4))}
        y={gate.y + gate.height / 2 + (site.horizontalFront ? OUTWARD[site.front].y * mm(4) : 0)}
        text={`GATE ${formatFeet(site.gateWidth)}`}
        mm={mm}
        size={1.8}
        weight={700}
        rotate={site.horizontalFront ? 0 : -90}
      />
    </g>
  )
}

function PlotBoundary({ site, mm }: { site: Site; mm: (v: number) => number }) {
  return (
    <rect
      {...site.plotRect}
      fill="none"
      stroke={INK.red}
      strokeWidth={mm(0.45)}
      strokeDasharray={`${mm(6)} ${mm(1.2)} ${mm(1)} ${mm(1.2)}`}
    />
  )
}

function PlotDims({ site, mm }: { site: Site; mm: (v: number) => number }) {
  const { plot, front } = site
  // Put dimensions on the sides away from the road.
  const xAt = front === 'S' ? -mm(10) : plot.height + mm(10)
  const yAt = front === 'E' ? -mm(10) : plot.width + mm(10)
  return (
    <g>
      <DimChain axis="x" stops={[0, plot.width]} at={xAt} mm={mm} />
      <DimChain axis="y" stops={[0, plot.height]} at={yAt} mm={mm} />
    </g>
  )
}

function UpperOutlines({ set, mm }: { set: DrawingSet; mm: (v: number) => number }) {
  return (
    <g>
      {set.models.slice(1).map((m) =>
        m.footprint ? (
          <g key={m.floor.id}>
            <rect {...m.footprint} fill="none" stroke={INK.mid} strokeWidth={mm(0.25)} strokeDasharray={`${mm(2)} ${mm(1)}`} />
          </g>
        ) : null,
      )}
    </g>
  )
}

export function SiteLayoutSheet(props: SheetProps) {
  const { set, sheet } = props
  const site = siteContext(set)
  const stats = areaStatement(set.plot, set.models)
  const drive = driveway(site)
  const bounds = { x: site.bounds.x - 6, y: site.bounds.y - 6, width: site.bounds.width + 12, height: site.bounds.height + 12 }
  return (
    <SheetFrame
      meta={sheetMeta(set, sheet)}
      bounds={bounds}
      northArrow
      aside={{
        width: 88,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Area statement',
                [
                  { title: 'ITEM', width: 0.62, value: (r: string[]) => r[0] },
                  { title: 'AREA', width: 0.38, align: 'end', value: (r: string[]) => r[1] },
                ],
                [
                  ['Plot area', fmtArea(stats.plotArea)],
                  ...stats.perFloor.map((f) => [`${f.name} built-up`, fmtArea(f.builtUp)]),
                  ['Total built-up area', fmtArea(stats.totalBuiltUp)],
                  ['Ground coverage', `${(stats.groundCoverage * 100).toFixed(1)} %`],
                  ['Floor area ratio (FAR)', stats.far.toFixed(2)],
                  ['Open space at ground', fmtArea(stats.openSpace)],
                ],
              ),
              tableBlock(
                'Site data',
                [
                  { title: 'PARAMETER', width: 0.55, value: (r: string[]) => r[0] },
                  { title: 'VALUE', width: 0.45, align: 'end', value: (r: string[]) => r[1] },
                ],
                [
                  ['Plot size', `${formatFeet(set.plot.width)} × ${formatFeet(set.plot.height)}`],
                  ['Road facing', set.plot.facing.toUpperCase()],
                  ['Road width', formatFeet(site.roadWidth)],
                  ['Floors', `G + ${set.models.length - 1}`],
                  ['Gate width', formatFeet(site.gateWidth)],
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
              { label: 'Plot boundary', symbol: swatch.line(INK.red, 0.45, '3 0.8 0.6 0.8') },
              { label: 'Compound wall (6" thk)', symbol: swatch.fill(INK.hatch) },
              { label: 'Building at ground floor', symbol: swatch.fill(INK.poche) },
              { label: 'Upper floor outline', symbol: swatch.line(INK.mid, 0.25, '1.5 0.8') },
              { label: 'Paved driveway', symbol: swatch.pattern('hatch-paving') },
              { label: 'Road', symbol: swatch.fill(INK.road, INK.road) },
            ]),
            notesBlock('Notes', [
              'Plot dimensions to be verified with the registered sale deed and site survey.',
              'Compound wall 6" thick, 5\'-0" high on the road side, 6\'-0" elsewhere.',
              'Finished ground level +0\'-0" = crown of road +0\'-9".',
              'Storm water to be drained towards the road-side drain.',
            ], 44),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <Road site={site} mm={mm} />
          <rect {...site.plotRect} fill="#fafaf7" />
          {drive && <rect {...drive} fill="url(#hatch-paving)" stroke={INK.hatch} strokeWidth={mm(0.12)} />}
          <CompoundWall site={site} mm={mm} />
          {site.ground && <PlanBase model={site.ground} mm={mm} labels="name" />}
          <UpperOutlines set={set} mm={mm} />
          <PlotBoundary site={site} mm={mm} />
          <PlotDims site={site} mm={mm} />
          {drive && (
            <Label x={drive.x + drive.width / 2} y={drive.y + drive.height / 2} text="DRIVEWAY" mm={mm} size={1.8} weight={700} rotate={site.horizontalFront ? -90 : 0} />
          )}
        </g>
      )}
    </SheetFrame>
  )
}

export function SetbacksSheet(props: SheetProps) {
  const { set, sheet } = props
  const site = siteContext(set)
  const required = requiredSetbacks(set.plot)
  const provided = site.footprint ? providedSetbacks(set.plot, site.footprint) : null
  const stats = areaStatement(set.plot, set.models)
  const sides: Side[] = ['N', 'E', 'S', 'W']
  const sideName = { N: 'North', E: 'East', S: 'South', W: 'West' }
  const role = (side: Side) => {
    const key = (Object.entries(SETBACK_SIDES[set.plot.facing]) as [string, Side][]).find(([, s]) => s === side)?.[0] ?? ''
    return key.charAt(0).toUpperCase() + key.slice(1)
  }
  const ok = (side: Side) => !provided || provided[side] + 0.01 >= required[side]
  const violations = sides.filter((s) => !ok(s))
  const setbackRect: Rect = {
    x: required.W,
    y: required.N,
    width: set.plot.width - required.W - required.E,
    height: set.plot.height - required.N - required.S,
  }
  const bounds = { x: site.bounds.x - 6, y: site.bounds.y - 6, width: site.bounds.width + 12, height: site.bounds.height + 12 }

  return (
    <SheetFrame
      meta={sheetMeta(set, sheet)}
      bounds={bounds}
      northArrow
      aside={{
        width: 92,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Setback compliance',
                [
                  { title: 'SIDE', width: 0.3, value: (s: Side) => `${sideName[s]} (${role(s)})` },
                  { title: 'REQUIRED', width: 0.22, align: 'end', value: (s: Side) => formatFeet(required[s]) },
                  { title: 'PROVIDED', width: 0.24, align: 'end', value: (s: Side) => (provided ? formatFeet(Math.max(0, provided[s])) : '—') },
                  { title: 'STATUS', width: 0.24, align: 'end', value: (s: Side) => (ok(s) ? 'OK' : 'SHORT') },
                ],
                sides,
              ),
              tableBlock(
                'Development controls',
                [
                  { title: 'CONTROL', width: 0.6, value: (r: string[]) => r[0] },
                  { title: 'PROPOSED', width: 0.4, align: 'end', value: (r: string[]) => r[1] },
                ],
                [
                  ['Ground coverage', `${(stats.groundCoverage * 100).toFixed(1)} %`],
                  ['Floor area ratio', stats.far.toFixed(2)],
                  ['Buildable envelope', `${formatFeet(Math.max(0, setbackRect.width))} × ${formatFeet(Math.max(0, setbackRect.height))}`],
                  ['Floors', `G + ${set.models.length - 1}`],
                ],
              ),
              notesBlock(
                violations.length ? 'Action required' : 'Status',
                violations.length
                  ? [
                      `Building footprint encroaches the required setback on the ${violations.map((s) => sideName[s]).join(', ')} side.`,
                      'Shift or resize rooms in the plan editor so the footprint stays inside the dashed buildable envelope, or revise setbacks in plot settings.',
                    ]
                  : ['Footprint lies within the buildable envelope on all sides.'],
                52,
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
              { label: 'Plot boundary', symbol: swatch.line(INK.red, 0.45, '3 0.8 0.6 0.8') },
              { label: 'Required setback line', symbol: swatch.line(INK.green, 0.4, '1.5 0.8') },
              { label: 'Building footprint', symbol: swatch.pattern('hatch-diag') },
              { label: 'Encroachment', symbol: swatch.fill(INK.redSoft, INK.red) },
            ]),
            notesBlock('Notes', [
              'Setbacks measured perpendicular from plot boundary to outer face of the building.',
              'Sunshades and balconies up to 2\'-0" projection are generally permitted within setbacks — verify with the local bye-laws.',
            ], 44),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <Road site={site} mm={mm} />
          <rect {...site.plotRect} fill="#fafaf7" />
          {site.footprint && <rect {...site.footprint} fill="url(#hatch-diag)" stroke={INK.line} strokeWidth={mm(0.35)} />}
          {site.footprint && violations.length > 0 && (
            <g>
              {violations.map((side) => {
                const fp = site.footprint!
                const r: Rect =
                  side === 'N'
                    ? { x: fp.x, y: fp.y, width: fp.width, height: required.N - fp.y }
                    : side === 'S'
                      ? { x: fp.x, y: set.plot.height - required.S, width: fp.width, height: fp.y + fp.height - (set.plot.height - required.S) }
                      : side === 'W'
                        ? { x: fp.x, y: fp.y, width: required.W - fp.x, height: fp.height }
                        : { x: set.plot.width - required.E, y: fp.y, width: fp.x + fp.width - (set.plot.width - required.E), height: fp.height }
                return r.width > 0 && r.height > 0 ? <rect key={side} {...r} fill={INK.redSoft} stroke={INK.red} strokeWidth={mm(0.2)} opacity={0.85} /> : null
              })}
            </g>
          )}
          {setbackRect.width > 0 && setbackRect.height > 0 && (
            <rect {...setbackRect} fill="none" stroke={INK.green} strokeWidth={mm(0.4)} strokeDasharray={`${mm(3)} ${mm(1.5)}`} />
          )}
          <PlotBoundary site={site} mm={mm} />
          {site.footprint && provided && (
            <g>
              {sides.map((side) => {
                const fp = site.footprint!
                const color = ok(side) ? INK.line : INK.red
                const midX = fp.x + fp.width / 2
                const midY = fp.y + fp.height / 2
                const req = required[side]
                const label = (x: number, y: number, rotate?: number) => (
                  <Label x={x} y={y} text={`REQ ${formatFeet(req)} / PROV ${formatFeet(Math.max(0, provided[side]))}`} mm={mm} size={1.8} weight={700} color={color} rotate={rotate} />
                )
                switch (side) {
                  case 'N':
                    return (
                      <g key={side}>
                        {fp.y > 0.2 && <DimChain axis="y" stops={[0, fp.y]} at={midX + fp.width / 4} mm={mm} color={color} />}
                        {label(midX, fp.y + mm(5))}
                      </g>
                    )
                  case 'S':
                    return (
                      <g key={side}>
                        {set.plot.height - fp.y - fp.height > 0.2 && <DimChain axis="y" stops={[fp.y + fp.height, set.plot.height]} at={midX + fp.width / 4} mm={mm} color={color} />}
                        {label(midX, fp.y + fp.height - mm(3))}
                      </g>
                    )
                  case 'W':
                    return (
                      <g key={side}>
                        {fp.x > 0.2 && <DimChain axis="x" stops={[0, fp.x]} at={midY + fp.height / 4} mm={mm} color={color} />}
                        {label(fp.x + mm(5), midY, -90)}
                      </g>
                    )
                  case 'E':
                    return (
                      <g key={side}>
                        {set.plot.width - fp.x - fp.width > 0.2 && <DimChain axis="x" stops={[fp.x + fp.width, set.plot.width]} at={midY + fp.height / 4} mm={mm} color={color} />}
                        {label(fp.x + fp.width - mm(3), midY, -90)}
                      </g>
                    )
                }
              })}
            </g>
          )}
          <PlotDims site={site} mm={mm} />
        </g>
      )}
    </SheetFrame>
  )
}

function Tree({ x, y, r, mm }: { x: number; y: number; r: number; mm: (v: number) => number }) {
  const spokes = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4)
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={INK.greenMid} fillOpacity={0.45} stroke={INK.green} strokeWidth={mm(0.2)} />
      {spokes.map((a) => (
        <line key={a} x1={x} y1={y} x2={x + Math.cos(a) * r * 0.75} y2={y + Math.sin(a) * r * 0.75} stroke={INK.green} strokeWidth={mm(0.1)} />
      ))}
      <circle cx={x} cy={y} r={Math.min(r * 0.12, 0.35)} fill={INK.green} />
    </g>
  )
}

function Shrub({ x, y, r }: { x: number; y: number; r: number }) {
  return <circle cx={x} cy={y} r={r} fill={INK.green} fillOpacity={0.55} />
}

export function LandscapingSheet(props: SheetProps) {
  const { set, sheet } = props
  const site = siteContext(set)
  const { trees, shrubs, avenue, planters, drive, lawnArea, planterLength } = landscapeLayout(set)
  const bounds = { x: site.bounds.x - 6, y: site.bounds.y - 6, width: site.bounds.width + 12, height: site.bounds.height + 12 }

  return (
    <SheetFrame
      meta={sheetMeta(set, sheet)}
      bounds={bounds}
      northArrow
      aside={{
        width: 92,
        render: (box) => (
          <Stack
            box={box}
            blocks={[
              tableBlock(
                'Plant schedule',
                [
                  { title: 'TYPE', width: 0.46, value: (r: string[]) => r[0] },
                  { title: 'SPECIES', width: 0.36, value: (r: string[]) => r[1] },
                  { title: 'QTY', width: 0.18, align: 'end', value: (r: string[]) => r[2] },
                ],
                [
                  ['Avenue tree (road verge)', 'Pongamia / Neem', String(avenue.length)],
                  ['Garden tree', 'Frangipani', String(trees.length)],
                  ['Hedge shrub', 'Ixora / Murraya', String(shrubs.length)],
                  ['Lawn', 'Mexican grass', lawnArea > 0 ? fmtArea(lawnArea) : '—'],
                  ['Paving', 'Cobble / pavers', drive ? fmtArea(drive.width * drive.height) : '—'],
                  ['Terrace planters', 'Herbs, seasonal', `${Math.round(planterLength)} rft`],
                ],
              ),
              notesBlock(
                'Landscape notes',
                [
                  lawnArea > 0
                    ? 'Lawn on 150mm red earth + 50mm sand bed over compacted sub-grade; slope 1:100 away from building.'
                    : 'The building covers the full buildable plot, so soft landscape is provided on the road verge and as a terrace garden.',
                  'Terrace planters: 450mm deep RCC/FRP boxes with waterproofing, drainage cell and geotextile, 1\'-3" wide along the parapet.',
                  'Drip irrigation from the overhead tank with a timer; rainwater from roof to recharge pit.',
                  'Keep trees min. 5\'-0" clear of foundations; use non-invasive root species.',
                ],
                52,
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
              { label: 'Lawn / soft landscape', symbol: swatch.pattern('hatch-lawn') },
              { label: 'Paving', symbol: swatch.pattern('hatch-paving') },
              { label: 'Tree', symbol: <circle r={2} fill={INK.greenMid} fillOpacity={0.45} stroke={INK.green} strokeWidth={0.2} /> },
              { label: 'Shrub / hedge', symbol: <circle r={1.2} fill={INK.green} fillOpacity={0.55} /> },
              { label: 'Terrace planter', symbol: swatch.fill(INK.greenSoft, INK.green) },
            ]),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <Road site={site} mm={mm} />
          <rect {...site.plotRect} fill="url(#hatch-lawn)" />
          {drive && <rect {...drive} fill="url(#hatch-paving)" stroke={INK.hatch} strokeWidth={mm(0.12)} />}
          <CompoundWall site={site} mm={mm} />
          {site.ground && <PlanBase model={site.ground} mm={mm} labels="name" muted showOpenings />}
          {planters.map((p, i) => (
            <rect key={i} {...p} fill={INK.greenSoft} stroke={INK.green} strokeWidth={mm(0.25)} />
          ))}
          {planters[0] && (
            <Label x={planters[0].x + planters[0].width / 2} y={planters[0].y + planters[0].height / 2 + mm(0.7)} text="TERRACE PLANTER (ABOVE)" mm={mm} size={1.6} color={INK.green} weight={700} />
          )}
          {shrubs.map((s, i) => (
            <Shrub key={i} {...s} />
          ))}
          {trees.map((t, i) => (
            <Tree key={i} {...t} mm={mm} />
          ))}
          {avenue.map((t, i) => (
            <Tree key={`a${i}`} x={t.x} y={t.y} r={2.5} mm={mm} />
          ))}
          <PlotBoundary site={site} mm={mm} />
          <PlotDims site={site} mm={mm} />
        </g>
      )}
    </SheetFrame>
  )
}
