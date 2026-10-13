import type { ReactNode } from 'react'
import { AlertTriangle, XCircle } from 'lucide-react'
import { PlanThumbnail } from '@/components/canvas/PlanThumbnail'
import { Badge } from '@/components/ui/Badge'
import { formatLakhs } from '@/lib/boq'
import { cn } from '@/lib/cn'
import { scoreVariant } from '@/lib/designCheck'
import type { GeneratedOption } from '@/lib/generator'
import type { Plot } from '@/types/design'

const BUDGET_VARIANT = { within: 'success', close: 'warning', over: 'danger' } as const

interface LayoutOptionCardProps {
  option: GeneratedOption
  plot: Plot
  /** The card's action, e.g. a "Use this layout" button. */
  footer: ReactNode
  selected?: boolean
  /** A short tag beside the title, e.g. "Recommended". */
  tag?: string
}

/** One generated layout: its floors, design score, cost, size and the main issues the design check found. */
export function LayoutOptionCard({ option, plot, footer, selected, tag }: LayoutOptionCardProps) {
  const issues = option.report.results.filter((r) => r.status !== 'pass').slice(0, 3)
  const bedrooms = option.floors.flatMap((f) => f.rooms).filter((r) => r.type === 'bedroom').length
  const bathrooms = option.floors.flatMap((f) => f.rooms).filter((r) => r.type === 'wet').length

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-md border bg-surface p-4 transition-shadow',
        selected ? 'border-primary shadow-md ring-2 ring-primary/20' : 'border-border',
      )}
      aria-current={selected || undefined}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold text-text">
          {option.label}
          {tag && <Badge variant="primary">{tag}</Badge>}
        </h3>
        <div className="flex items-center gap-1.5">
          <Badge variant={scoreVariant(option.report.score)} className="font-mono tabular-nums">
            Score {option.report.score}
          </Badge>
          <Badge variant={option.estimate.budget ? BUDGET_VARIANT[option.estimate.budget.status] : 'neutral'} className="font-mono tabular-nums">
            {formatLakhs(option.estimate.total)}
          </Badge>
        </div>
      </div>
      <p className="text-xs text-text-muted">
        {option.estimate.builtUpArea.toLocaleString('en-IN')} sq ft · {bedrooms} bedrooms · {bathrooms} bathrooms
        {option.summary && <> · {option.summary}</>}
      </p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${option.floors.length}, minmax(0, 1fr))` }}>
        {option.floors.map((floor) => (
          <figure key={floor.id} className="flex flex-col gap-1">
            <PlanThumbnail plot={plot} floor={floor} className="aspect-square w-full rounded-sm bg-surface-2" />
            <figcaption className="text-center text-[11px] text-text-muted">{floor.name}</figcaption>
          </figure>
        ))}
      </div>
      {issues.length > 0 && (
        <ul className="flex flex-col gap-1">
          {issues.map((issue) => (
            <li key={issue.id} className="flex items-start gap-1.5 text-xs text-text-muted">
              {issue.status === 'fail' ? <XCircle className="mt-px size-3.5 shrink-0 text-danger" /> : <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" />}
              {issue.title}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto">{footer}</div>
    </article>
  )
}
