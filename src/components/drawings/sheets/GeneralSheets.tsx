import { EXTRA_ROOM_OPTIONS, FAMILY_TYPE_OPTIONS, KITCHEN_OPTIONS, PLOT_SHAPE_OPTIONS, STYLE_OPTIONS, floorsLabel } from '@/lib/brief'
import { type BoqEstimate, type BoqSection, estimateBoq, formatLakhs } from '@/lib/boq'
import { requirementsFor } from '@/lib/byelaws'
import { CATEGORY_LABELS, type CheckResult, type DesignReport, runDesignCheck } from '@/lib/designCheck'
import { type PlanRoom, area, areaStatement, formatFeet, requiredSetbacks } from '@/lib/drawings/geometry'
import type { DrawingSet } from '@/lib/drawings/sheets'
import { INK, SheetFrame, Stack, notesBlock, tableBlock } from '../SheetFrame'
import { Label, PlanBase } from '../symbols'
import { type SheetProps, fmtArea, padBounds, sheetFloor, sheetMeta } from './common'

/**
 * General sheets for the customer and contractor: what was asked for and how the design answers it
 * (brief, areas, bye-laws, design check), and what it costs (room-wise BOQ against the budget).
 */

const label = <T extends string>(options: { value: T; label: string }[], value: T) => options.find((o) => o.value === value)?.label ?? value

function estimateFor(set: DrawingSet): BoqEstimate {
  return estimateBoq({ plot: set.plot, floors: set.models.map((m) => m.floor), brief: set.brief, budget: set.budget })
}

function reportFor(set: DrawingSet, estimate: BoqEstimate): DesignReport {
  const cost = estimate.budget ? { estimate: estimate.total, budget: estimate.budget.amount, turnkey: estimate.includeInteriors } : null
  return runDesignCheck({ plot: set.plot, floors: set.models.map((m) => m.floor), brief: set.brief, cost })
}

function briefRows(set: DrawingSet): string[][] {
  const { plot, brief, budget } = set
  const rows: string[][] = [[
    'Plot',
    `${formatFeet(plot.width)} × ${formatFeet(plot.height)} (${fmtArea(plot.width * plot.height)}), ${plot.facing}-facing${brief?.cornerPlot ? ', corner' : ''}`,
  ]]
  if (brief) {
    rows.push(
      ['Plot shape', label(PLOT_SHAPE_OPTIONS, brief.plotShape) + (brief.plotShapeNotes ? ` — ${brief.plotShapeNotes}` : '')],
      ['Location', [brief.city, brief.state].filter(Boolean).join(', ') || 'Not given'],
      ['Road in front', brief.roadWidthFt ? `${brief.roadWidthFt} ft` : 'Not given'],
      ['Floors', floorsLabel(brief.floors)],
      ['Bedrooms · bathrooms', `${brief.bedrooms} BHK · ${brief.bathrooms} bath`],
      ['Kitchen · parking', `${label(KITCHEN_OPTIONS, brief.kitchenType)} · ${brief.parkingCars} car${brief.parkingCars === 1 ? '' : 's'}`],
      ['Extra rooms', brief.extraRooms.map((r) => label(EXTRA_ROOM_OPTIONS, r)).join(', ') || 'None'],
      ['Family', `${brief.familySize} · ${label(FAMILY_TYPE_OPTIONS, brief.familyType)}${brief.needsGroundFloorBedroom ? ' · ground-floor bedroom' : ''}`],
      ['Style · Vastu', `${label(STYLE_OPTIONS, brief.style)} · Vastu ${brief.vastu ? 'on' : 'off'}`],
    )
  }
  if (budget) rows.push(['Budget', `${formatLakhs(budget.amount)} (${budget.turnkey ? 'turnkey' : 'construction only'})`])
  return rows
}

/** INK.gold mixed into white by `t` — a solid colour, since not every SVG or PDF renderer handles rgba(). */
function tint(t: number) {
  const gold = [0xb7, 0x79, 0x1f]
  return `#${gold.map((c) => Math.round(255 + (c - 255) * t).toString(16).padStart(2, '0')).join('')}`
}

const STATUS_TEXT = { pass: 'OK', warn: 'CHECK', fail: 'FAIL' } as const

export function SummarySheet(props: SheetProps) {
  const { set, sheet } = props
  const ground = set.models[0]
  const estimate = estimateFor(set)
  const report = reportFor(set, estimate)
  const rules = requirementsFor(set.plot, set.brief)
  const stats = areaStatement(set.plot, set.models)
  const setbacks = requiredSetbacks(set.plot)
  const plotRect = { x: 0, y: 0, width: set.plot.width, height: set.plot.height }
  const compliance = report.results.filter((r) => r.category === 'compliance')
  const categories = report.categories.filter((c) => c.score !== null)

  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { note: 'Indicative design and estimate for discussion. Confirm bye-laws, structure and rates with licensed professionals before construction.' })}
      bounds={padBounds(plotRect, 4, plotRect)}
      northArrow
      aside={{
        width: 150,
        render: (box) => (
          <Stack
            box={box}
            gap={4}
            blocks={[
              tableBlock(
                'Client brief',
                [
                  { title: 'ITEM', width: 0.28, value: (r: string[]) => r[0] },
                  { title: 'REQUIREMENT', width: 0.72, value: (r: string[]) => r[1] },
                ],
                briefRows(set),
              ),
              tableBlock(
                'Area statement',
                [
                  { title: 'FLOOR', width: 0.4, value: (r: string[]) => r[0] },
                  { title: 'CARPET', width: 0.3, align: 'end', value: (r: string[]) => r[1] },
                  { title: 'BUILT-UP', width: 0.3, align: 'end', value: (r: string[]) => r[2] },
                ],
                stats.perFloor.map((f) => [f.name, fmtArea(f.carpet), fmtArea(f.builtUp)]),
                { footer: ['Total', fmtArea(stats.perFloor.reduce((s, f) => s + f.carpet, 0)), fmtArea(stats.totalBuiltUp)] },
              ),
              tableBlock(
                `Bye-laws — ${rules.set.status === 'placeholder' ? 'placeholder rules' : rules.set.name}`,
                [
                  { title: 'CHECK', width: 0.84, value: (r: CheckResult) => r.title },
                  { title: 'RESULT', width: 0.16, align: 'end', value: (r: CheckResult) => STATUS_TEXT[r.status] },
                ],
                compliance,
              ),
              tableBlock(
                'Design check',
                [
                  { title: 'CATEGORY', width: 0.5, value: (c: (typeof categories)[number]) => CATEGORY_LABELS[c.category] },
                  { title: 'SCORE', width: 0.2, align: 'end', value: (c) => String(c.score) },
                  { title: 'TO REVIEW', width: 0.3, align: 'end', value: (c) => String(c.results.filter((r) => r.status !== 'pass').length) },
                ],
                categories,
                { footer: ['Overall', String(report.score), String(report.results.filter((r) => r.status !== 'pass').length)] },
              ),
            ]}
          />
        ),
      }}
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            notesBlock('Estimate', [
              `${formatLakhs(estimate.total)} for ${fmtArea(estimate.builtUpArea)} built-up (${formatLakhs(estimate.costPerSqft)}/sft), ${estimate.includeInteriors ? 'turnkey' : 'construction only'}.`,
              estimate.budget
                ? `Budget ${formatLakhs(estimate.budget.amount)}: ${estimate.budget.status === 'within' ? 'within budget' : estimate.budget.status === 'close' ? 'close to budget' : 'over budget'}.`
                : 'No budget given.',
              'Room-wise costs: sheet G-002.',
            ]),
            notesBlock('Bye-law basis', [
              `${rules.set.name}. ${rules.set.source}`,
              ...rules.assumptions,
              `Setbacks used on the plot: front ${set.plot.setbacks.front}, rear ${set.plot.setbacks.rear}, left ${set.plot.setbacks.left}, right ${set.plot.setbacks.right} ft.`,
            ]),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <rect {...plotRect} fill="none" stroke={INK.line} strokeWidth={mm(0.5)} strokeDasharray={`${mm(3)} ${mm(0.8)} ${mm(0.6)} ${mm(0.8)}`} />
          <rect
            x={setbacks.W}
            y={setbacks.N}
            width={Math.max(0, set.plot.width - setbacks.W - setbacks.E)}
            height={Math.max(0, set.plot.height - setbacks.N - setbacks.S)}
            fill="none"
            stroke={INK.red}
            strokeWidth={mm(0.25)}
            strokeDasharray={`${mm(1.5)} ${mm(1)}`}
          />
          {ground && <PlanBase model={ground} mm={mm} labels="name" />}
        </g>
      )}
    </SheetFrame>
  )
}

export function EstimateSheet(props: SheetProps) {
  const { set, sheet } = props
  const model = sheetFloor(props)
  const estimate = estimateFor(set)
  const byRoom = new Map(estimate.sections.filter((s) => s.kind === 'room' && s.roomId).map((s) => [s.roomId!, s]))
  const rooms = model.rooms.map((room) => ({ room, section: byRoom.get(room.id) ?? null }))
  const floorTotal = rooms.reduce((s, r) => s + (r.section?.subtotal ?? 0), 0)
  const building = estimate.sections.filter((s) => s.kind === 'building')
  const roomsTotal = estimate.sections.filter((s) => s.kind === 'room').reduce((s, r) => s + r.subtotal, 0)
  const max = Math.max(1, ...rooms.map((r) => (r.section ? r.section.subtotal / Math.max(1, area(r.room)) : 0)))
  const fp = model.footprint
  const bounds = padBounds(fp, (fp ? Math.max(fp.width, fp.height) : 30) * 0.12 + 3, { x: 0, y: 0, width: set.plot.width, height: set.plot.height })
  // Rooms shaded by cost per square foot: wet rooms and kitchens stand out.
  const fill = (room: PlanRoom) => {
    const section = byRoom.get(room.id)
    if (!section) return INK.paper
    return tint(0.08 + (section.subtotal / Math.max(1, area(room)) / max) * 0.32)
  }
  const summary: string[][] = [
    ...building.map((s: BoqSection) => [s.title, formatLakhs(s.subtotal)]),
    ['Rooms: finishes, fittings, services', formatLakhs(roomsTotal)],
    ...estimate.overheads.map((o) => [`${o.label} (${Math.round(o.pct * 100)}%)`, formatLakhs(o.amount)]),
  ]
  const budgetNote = estimate.budget
    ? `${estimate.budget.difference >= 0 ? 'Under' : 'Over'} budget by ${formatLakhs(Math.abs(estimate.budget.difference))} (budget ${formatLakhs(estimate.budget.amount)}).`
    : 'No budget given.'

  return (
    <SheetFrame
      meta={sheetMeta(set, sheet, { subtitle: model.floor.name, note: 'Indicative estimate at placeholder rates. Get contractor quotes before committing.' })}
      bounds={bounds}
      northArrow
      aside={{
        width: 150,
        render: (box) => (
          <Stack
            box={box}
            gap={4}
            blocks={[
              tableBlock(
                `Room-wise cost — ${model.floor.name}`,
                [
                  { title: 'ROOM', width: 0.4, value: (r: (typeof rooms)[number]) => r.room.name },
                  { title: 'AREA', width: 0.18, align: 'end', value: (r) => fmtArea(area(r.room)) },
                  { title: 'COST', width: 0.22, align: 'end', value: (r) => (r.section ? formatLakhs(r.section.subtotal) : '—') },
                  { title: 'PER SFT', width: 0.2, align: 'end', value: (r) => (r.section ? formatLakhs(r.section.subtotal / Math.max(1, area(r.room))) : '—') },
                ],
                rooms,
                { footer: ['Floor total', fmtArea(rooms.reduce((s, r) => s + area(r.room), 0)), formatLakhs(floorTotal), ''] },
              ),
              tableBlock(
                'Estimate summary — whole house',
                [
                  { title: 'ITEM', width: 0.7, value: (r: string[]) => r[0] },
                  { title: 'AMOUNT', width: 0.3, align: 'end', value: (r: string[]) => r[1] },
                ],
                summary,
                { footer: ['Estimated total', formatLakhs(estimate.total)] },
              ),
            ]}
          />
        ),
      }}
      side={(box) => (
        <Stack
          box={box}
          blocks={[
            notesBlock('Estimate', [
              `${formatLakhs(estimate.total)} for ${fmtArea(estimate.builtUpArea)} built-up: ${formatLakhs(estimate.costPerSqft)} per sft.`,
              `Scope: ${estimate.includeInteriors ? 'turnkey (construction + interiors)' : 'construction only'}.`,
              budgetNote,
              `Location factor ${estimate.location.factor} (${estimate.location.label}).`,
              `${estimate.ratesAsOf}.`,
              'The line-by-line BOQ downloads as CSV from Cost estimate in the editor.',
            ]),
          ]}
        />
      )}
    >
      {({ mm }) => (
        <g>
          <PlanBase model={model} mm={mm} labels="name" roomFill={fill} />
          {rooms.map(({ room, section }) =>
            section ? (
              <Label key={room.id} x={room.x + room.width / 2} y={room.y + room.height / 2 + mm(3.6)} text={formatLakhs(section.subtotal)} mm={mm} size={2.1} weight={700} color={INK.gold} />
            ) : null,
          )}
        </g>
      )}
    </SheetFrame>
  )
}
