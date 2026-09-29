import { useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { downloadBlob } from '@/components/drawings/exportSheets'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SidePanel } from '@/components/ui/SidePanel'
import { useCostEstimate } from '@/hooks/useCostEstimate'
import { UNIT_LABELS, boqToCsv, formatLakhs, type BoqEstimate, type BoqSection } from '@/lib/boq'
import { cn } from '@/lib/cn'
import { formatCurrency } from '@/lib/format'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'

type Scope = 'construction' | 'turnkey'

const BUDGET_TONE: Record<NonNullable<BoqEstimate['budget']>['status'], string> = {
  within: 'text-success',
  close: 'text-warning',
  over: 'text-danger',
}

function budgetSummary(budget: NonNullable<BoqEstimate['budget']>) {
  const pct = Math.max(1, Math.round((Math.abs(budget.difference) / budget.amount) * 100))
  return budget.difference >= 0
    ? `${formatLakhs(budget.difference)} under budget`
    : `${formatLakhs(-budget.difference)} over budget (${pct}%)`
}

function SectionRows({ section, defaultOpen = false }: { section: BoqSection; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm transition-colors hover:text-text"
      >
        <span className="flex min-w-0 items-center gap-1.5 text-text">
          <ChevronDown className={cn('size-4 shrink-0 text-text-muted transition-transform', open && 'rotate-180')} />
          <span className="truncate">{section.title}</span>
        </span>
        <span className="shrink-0 font-mono text-sm tabular-nums text-text">{formatLakhs(section.subtotal)}</span>
      </button>
      {open && (
        <ul className="mb-2 ml-5 flex flex-col gap-1.5">
          {section.lines.map((line) => (
            <li key={line.id} className="flex items-start justify-between gap-3 text-xs">
              <span className="min-w-0 text-text-muted">
                {line.description}
                {line.interiors && <span className="ml-1.5 rounded-sm bg-primary-soft px-1 text-[10px] font-medium text-primary">Interiors</span>}
                <span className="block text-text-faint">
                  {line.quantity.toLocaleString('en-IN')} {UNIT_LABELS[line.unit]} × {formatCurrency(line.rate)}
                </span>
              </span>
              <span className="shrink-0 font-mono tabular-nums text-text">{formatCurrency(line.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function EstimateBody() {
  const projectId = useDesignStore((state) => state.projectId)
  const project = useProjectsStore((state) => state.projects.find((p) => p.id === projectId) ?? null)
  const [scope, setScope] = useState<Scope | null>(null)
  const defaultScope: Scope = project?.turnkey ? 'turnkey' : 'construction'
  const activeScope = scope ?? defaultScope
  const estimate = useCostEstimate(activeScope === 'turnkey')

  if (estimate.sections.length === 0) {
    return <p className="px-5 py-4 text-sm text-text-muted">Add rooms to the plan to see the cost estimate.</p>
  }

  const building = estimate.sections.filter((s) => s.kind === 'building')
  const rooms = estimate.sections.filter((s) => s.kind === 'room')
  const roomsTotal = rooms.reduce((sum, s) => sum + s.subtotal, 0)
  const budgetScope: Scope = project?.turnkey ? 'turnkey' : 'construction'

  function downloadCsv() {
    const name = project?.name ?? 'Project'
    // The byte-order mark lets Excel read the ₹ sign and other UTF-8 text correctly.
    downloadBlob(`﻿${boqToCsv(estimate, name)}`, 'text/csv;charset=utf-8', `${name} BOQ ${activeScope}.csv`)
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <SegmentedControl<Scope>
        value={activeScope}
        onChange={setScope}
        options={[
          { value: 'construction', label: 'Construction only' },
          { value: 'turnkey', label: 'Turnkey' },
        ]}
        className="grid w-full grid-cols-2"
      />

      <div className="rounded-md bg-surface-2 px-4 py-3">
        <p className="text-xs text-text-muted">Estimated total</p>
        <p className="font-display text-3xl font-bold tabular-nums text-text">{formatLakhs(estimate.total)}</p>
        <p className="mt-0.5 text-xs text-text-muted">
          {formatCurrency(estimate.total)} · {formatCurrency(estimate.costPerSqft)}/sq ft ·{' '}
          {estimate.builtUpArea.toLocaleString('en-IN')} sq ft built-up
        </p>
        {estimate.budget && (
          <p className={cn('mt-2 text-sm font-medium', BUDGET_TONE[estimate.budget.status])}>
            {budgetSummary(estimate.budget)}
            <span className="font-normal text-text-muted">
              {' '}
              · budget {formatLakhs(estimate.budget.amount)} ({budgetScope === 'turnkey' ? 'turnkey' : 'construction only'})
            </span>
          </p>
        )}
        {estimate.budget && activeScope !== budgetScope && (
          <p className="mt-1 text-xs text-text-muted">
            Your budget is {budgetScope === 'turnkey' ? 'turnkey' : 'construction only'}; this compares it with the{' '}
            {activeScope === 'turnkey' ? 'turnkey' : 'construction-only'} estimate.
          </p>
        )}
        {activeScope === 'construction' && estimate.interiorItems > 0 && (
          <p className="mt-1 text-xs text-text-muted">Interiors would add about {formatLakhs(estimate.interiorItems * 1.15)}.</p>
        )}
      </div>

      <section>
        <h3 className="mb-1 text-sm font-semibold text-text">Building</h3>
        <div className="rounded-md border border-border px-3">
          {building.map((section) => (
            <SectionRows key={section.id} section={section} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold text-text">Room-wise</h3>
          <span className="font-mono text-sm tabular-nums text-text-muted">{formatLakhs(roomsTotal)}</span>
        </div>
        <div className="rounded-md border border-border px-3">
          {rooms.map((section) => (
            <SectionRows key={section.id} section={section} />
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-1.5 rounded-md border border-border px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-text-muted">Items total</span>
          <span className="font-mono tabular-nums">{formatCurrency(estimate.itemsTotal)}</span>
        </div>
        {estimate.overheads.map((o) => (
          <div key={o.id} className="flex justify-between">
            <span className="text-text-muted">
              {o.label} ({Math.round(o.pct * 100)}%)
            </span>
            <span className="font-mono tabular-nums">{formatCurrency(o.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
          <span>Estimated total</span>
          <span className="font-mono tabular-nums">{formatCurrency(estimate.total)}</span>
        </div>
      </div>

      <Button variant="outline" onClick={downloadCsv} className="gap-2">
        <Download className="size-4" />
        Download BOQ (CSV, opens in Excel)
      </Button>

      <p className="text-xs text-text-faint">
        {estimate.ratesAsOf}. Location: {estimate.location.label} (× {estimate.location.factor}). Quantities come from the plan
        and its drawings. Not included: GST, loose furniture and appliances, compound wall and landscaping, land, approvals
        and fees.
      </p>
    </div>
  )
}

/** Room-wise BOQ and cost estimate against the budget, recalculated live as the plan changes. */
export function CostEstimatePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Cost estimate"
      description="Bill of quantities for this plan, priced room by room and compared with your budget."
      defaultWidth={460}
    >
      {open && <EstimateBody />}
    </SidePanel>
  )
}
