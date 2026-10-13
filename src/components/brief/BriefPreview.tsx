import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, IndianRupee, LayoutDashboard, MapPin, Ruler } from 'lucide-react'
import { PlanThumbnail } from '@/components/canvas/PlanThumbnail'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { formatLakhs } from '@/lib/boq'
import { compliantSetbacks, requirementsFor } from '@/lib/byelaws'
import { cn } from '@/lib/cn'
import { scoreVariant } from '@/lib/designCheck'
import { generateOptions, type GenerateResult } from '@/lib/generator'
import type { Plot } from '@/types/design'
import { PlotDiagram } from './PlotDiagram'
import { BUDGET_STEP, PLOT_STEP, ROOMS_STEP, SITE_STEP, STYLE_STEP, type FormState, type StepIndex, plotFromForm } from './briefForm'

const BUDGET_VARIANT = { within: 'success', close: 'warning', over: 'danger' } as const
const BUDGET_TEXT = { within: 'Within budget', close: 'Close to budget', over: 'Over budget' } as const

function Card({ icon, title, active, aside, children }: { icon: ReactNode; title: string; active: boolean; aside?: ReactNode; children: ReactNode }) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-surface p-4 transition-shadow',
        active ? 'border-primary shadow-md ring-2 ring-primary/15' : 'border-border',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text [&>svg]:size-4 [&>svg]:text-text-muted">
          {icon}
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-surface-2 px-3 py-2">
      <span className="text-[11px] font-medium tracking-wide text-text-muted uppercase">{label}</span>
      <span className="font-mono text-sm font-semibold tabular-nums text-text">{value}</span>
      {note && <span className="text-[11px] text-text-faint">{note}</span>}
    </div>
  )
}

const sqft = (n: number) => `${Math.round(n).toLocaleString('en-IN')} sq ft`

/**
 * The onboarding page's right-hand side: what the brief so far adds up to. The plot to scale with
 * what the rules leave to build on, a first concept plan generated from the brief, and its cost
 * against the budget. The card for the current step is highlighted.
 */
export function BriefPreview({ form, step }: { form: FormState; step: StepIndex }) {
  const basePlot = plotFromForm(form)
  const rules = basePlot ? requirementsFor(basePlot, form.brief) : null
  const plot: Plot | null = basePlot && rules ? { ...basePlot, setbacks: compliantSetbacks(basePlot.setbacks, rules.setbacks) } : null
  const budget = Number(form.budget) > 0 ? { amount: Number(form.budget), turnkey: form.turnkey } : null

  // The concept is regenerated a moment after the inputs settle, not on every keystroke.
  const key = JSON.stringify({ plot: basePlot, brief: form.brief, budget })
  const [concept, setConcept] = useState<{ key: string; result: GenerateResult } | null>(null)
  useEffect(() => {
    if (!basePlot) return
    const timer = window.setTimeout(() => {
      setConcept({ key, result: generateOptions({ plot: basePlot, brief: form.brief, budget, count: 1 }) })
    }, 400)
    return () => window.clearTimeout(timer)
    // `key` covers the plot, brief and budget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const result = concept?.key === key ? concept.result : null
  const option = result?.ok ? result.options[0] : null
  const stale = !!basePlot && !result

  const plotArea = plot ? plot.width * plot.height : 0
  const buildable = plot
    ? Math.max(0, plot.width - plot.setbacks.left - plot.setbacks.right) * Math.max(0, plot.height - plot.setbacks.front - plot.setbacks.rear)
    : 0
  const rooms = useMemo(() => option?.floors.flatMap((f) => f.rooms) ?? [], [option])
  const bedrooms = rooms.filter((r) => r.type === 'bedroom').length
  const bathrooms = rooms.filter((r) => r.type === 'wet').length
  const estimate = option?.estimate
  const budgetShare = estimate?.budget ? Math.min(100, (estimate.total / Math.max(estimate.total, estimate.budget.amount)) * 100) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Live preview</p>
          <h2 className="truncate font-display text-xl font-semibold text-text">{form.name.trim() || 'Your new home'}</h2>
          {form.site && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-text-muted">
              <MapPin className="size-3.5 shrink-0" />
              {form.site.formattedAddress || [form.brief.city, form.brief.state].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
        {stale && (
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <Spinner size="sm" /> Updating
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <Card icon={<Ruler />} title="Your plot" active={step === SITE_STEP || step === PLOT_STEP}>
          {plot && rules ? (
            <>
              <PlotDiagram plot={plot} roadWidthFt={form.brief.roadWidthFt} className="mx-auto h-72 w-full" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                <Stat label="Plot area" value={sqft(plotArea)} />
                <Stat label="Inside setbacks" value={sqft(buildable)} />
                <Stat label="Ground cover" value={`${Math.round(rules.maxCoverage * 100)}%`} note={`up to ${sqft(rules.maxCoverage * plotArea)}`} />
                <Stat label="Total built-up" value={sqft(rules.far * plotArea)} note={`FAR ${rules.far}`} />
                <Stat label="Height limit" value={`${rules.maxHeightFt} ft`} />
                <Stat label="Parking" value={`${rules.parkingCars} car${rules.parkingCars === 1 ? '' : 's'}`} note="required" />
              </div>
              <p className="text-[11px] text-text-faint">
                {rules.set.name}. {rules.assumptions.join(' ')}
              </p>
            </>
          ) : (
            <p className="py-8 text-center text-sm text-text-muted">Enter the plot's width and length to see it here.</p>
          )}
        </Card>

        <Card
          icon={<LayoutDashboard />}
          title="Concept plan"
          active={step === ROOMS_STEP || step === STYLE_STEP}
          aside={option && <Badge variant={scoreVariant(option.report.score)} className="font-mono tabular-nums">Score {option.report.score}</Badge>}
        >
          {option && plot ? (
            <>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(option.floors.length, 2)}, minmax(0, 1fr))` }}>
                {option.floors.map((floor) => (
                  <figure key={floor.id} className="flex flex-col gap-1">
                    <PlanThumbnail plot={plot} floor={floor} className="aspect-square w-full rounded-sm bg-surface-2" />
                    <figcaption className="text-center text-[11px] text-text-muted">{floor.name}</figcaption>
                  </figure>
                ))}
              </div>
              <p className="text-xs text-text-muted">
                {sqft(option.estimate.builtUpArea)} built up · {bedrooms} bedroom{bedrooms === 1 ? '' : 's'} · {bathrooms} bathroom{bathrooms === 1 ? '' : 's'}
                {option.summary && <> · {option.summary}</>}
              </p>
              {result?.ok && result.notes.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {result.notes.map((note) => (
                    <li key={note} className="flex items-start gap-1.5 text-xs text-text-muted">
                      <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" />
                      {note}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[11px] text-text-faint">A first concept from your brief. In the workspace you can generate several options and edit any of them.</p>
            </>
          ) : result && !result.ok ? (
            <p className="flex items-start gap-1.5 py-6 text-sm text-text-muted">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              {result.reason}
            </p>
          ) : (
            <div className="flex items-center justify-center py-10">{basePlot ? <Spinner /> : <p className="text-sm text-text-muted">Waiting for the plot size.</p>}</div>
          )}
        </Card>
      </div>

      <Card
        icon={<IndianRupee />}
        title="Estimated cost"
        active={step === BUDGET_STEP}
        aside={estimate?.budget && <Badge variant={BUDGET_VARIANT[estimate.budget.status]}>{BUDGET_TEXT[estimate.budget.status]}</Badge>}
      >
        {estimate ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-2xl font-semibold tabular-nums text-text">{formatLakhs(estimate.total)}</span>
              <span className="text-sm text-text-muted">
                about ₹{Math.round(estimate.costPerSqft).toLocaleString('en-IN')}/sq ft · {estimate.includeInteriors ? 'turnkey, with interiors' : 'construction only'}
              </span>
            </div>
            {estimate.budget && budgetShare !== null && (
              <div className="flex flex-col gap-1">
                <div className="relative h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn('h-full rounded-full', estimate.budget.status === 'within' ? 'bg-success' : estimate.budget.status === 'close' ? 'bg-warning' : 'bg-danger')}
                    style={{ width: `${budgetShare}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted">
                  Budget {formatLakhs(estimate.budget.amount)} ·{' '}
                  {estimate.budget.difference >= 0 ? `${formatLakhs(estimate.budget.difference)} to spare` : `${formatLakhs(-estimate.budget.difference)} over`}
                </p>
              </div>
            )}
            <p className="text-[11px] text-text-faint">
              For the concept plan above. Rates: {estimate.location.label}; {estimate.ratesAsOf}.
            </p>
          </>
        ) : (
          <p className="py-4 text-sm text-text-muted">{budget ? 'Worked out once there is a concept plan.' : 'Enter a budget to compare against.'}</p>
        )}
      </Card>
    </div>
  )
}

