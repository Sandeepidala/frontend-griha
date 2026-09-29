import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, CircleSlash, XCircle } from 'lucide-react'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SidePanel } from '@/components/ui/SidePanel'
import { cn } from '@/lib/cn'
import {
  CATEGORY_LABELS,
  scoreVariant,
  type CategoryScore,
  type CheckResult,
  type CheckStatus,
  type DesignReport,
} from '@/lib/designCheck'
import { useDesignStore } from '@/stores/useDesignStore'

function scoreLabel(score: number) {
  return score >= 80 ? 'Good' : score >= 60 ? 'Needs some work' : 'Needs attention'
}

const STATUS_ICON: Record<CheckStatus, { icon: typeof XCircle; className: string; label: string }> = {
  fail: { icon: XCircle, className: 'text-danger', label: 'Problem' },
  warn: { icon: AlertTriangle, className: 'text-warning', label: 'Suggestion' },
  pass: { icon: CheckCircle2, className: 'text-success', label: 'Passed' },
}

function ResultRow({ result }: { result: CheckResult }) {
  const setActiveFloorId = useDesignStore((state) => state.setActiveFloorId)
  const select = useDesignStore((state) => state.select)
  const viewMode = useDesignStore((state) => state.viewMode)
  const setViewMode = useDesignStore((state) => state.setViewMode)
  const { icon: Icon, className, label } = STATUS_ICON[result.status]
  const roomId = result.roomIds?.[0]

  function showInPlan() {
    if (result.floorId) setActiveFloorId(result.floorId)
    if (roomId) select({ type: 'room', id: roomId })
    if (viewMode === 'drawings') setViewMode('2d')
  }

  return (
    <li className="flex gap-2.5 py-2">
      <Icon className={cn('mt-0.5 size-4 shrink-0', className)} aria-label={label} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text">{result.title}</p>
        {result.detail && <p className="mt-0.5 text-xs text-text-muted">{result.detail}</p>}
      </div>
      {(roomId || result.floorId) && result.status !== 'pass' && (
        <button type="button" onClick={showInPlan} className="h-fit shrink-0 text-xs font-medium text-primary hover:underline">
          Show
        </button>
      )}
    </li>
  )
}

function CategorySection({ category }: { category: CategoryScore }) {
  const [showPassed, setShowPassed] = useState(false)
  const issues = category.results.filter((r) => r.status !== 'pass')
  const passed = category.results.filter((r) => r.status === 'pass')
  const score = category.score ?? 0

  return (
    <section className="rounded-md border border-border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text">{CATEGORY_LABELS[category.category]}</h3>
        <span className="font-mono text-sm tabular-nums text-text-muted">{category.score ?? '—'}</span>
      </div>
      {category.score !== null && <ProgressBar value={score} className="mt-2" variant={scoreVariant(score)} />}
      {issues.length > 0 && (
        <ul className="mt-1 divide-y divide-border">
          {issues.map((result) => (
            <ResultRow key={result.id} result={result} />
          ))}
        </ul>
      )}
      {passed.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowPassed((v) => !v)}
            aria-expanded={showPassed}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text"
          >
            <ChevronDown className={cn('size-3.5 transition-transform', showPassed && 'rotate-180')} />
            {passed.length} {passed.length === 1 ? 'check' : 'checks'} passed
          </button>
          {showPassed && (
            <ul className="divide-y divide-border">
              {passed.map((result) => (
                <ResultRow key={result.id} result={result} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/** The design check report: an overall score, each category, and every problem with a link to the room. */
export function DesignCheckPanel({ open, onClose, report }: { open: boolean; onClose: () => void; report: DesignReport }) {
  const problems = report.results.filter((r) => r.status === 'fail').length
  const suggestions = report.results.filter((r) => r.status === 'warn').length
  const empty = report.categories.length === 0

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Design check"
      description="Checked live against the brief, budget, standard room sizes, daylight, privacy, Vastu and setbacks."
      defaultWidth={440}
    >
      <div className="flex flex-col gap-4 px-5 py-4">
        {empty ? (
          <p className="text-sm text-text-muted">Add rooms to the plan to see the design check.</p>
        ) : (
          <div className="rounded-md bg-surface-2 px-4 py-3">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-3xl font-bold tabular-nums text-text">
                {report.score}
                <span className="text-base font-normal text-text-muted">/100</span>
              </span>
              <span className="text-sm font-medium text-text">{scoreLabel(report.score)}</span>
            </div>
            <ProgressBar value={report.score} className="mt-2" variant={scoreVariant(report.score)} />
            <p className="mt-2 text-xs text-text-muted">
              {problems} {problems === 1 ? 'problem' : 'problems'} · {suggestions} {suggestions === 1 ? 'suggestion' : 'suggestions'}
            </p>
          </div>
        )}

        {report.categories.map((category) => (
          <CategorySection key={category.category} category={category} />
        ))}

        {report.skipped.map((skip) => (
          <div key={skip.category} className="flex items-center gap-2.5 px-1 text-xs text-text-muted">
            <CircleSlash className="size-4 shrink-0" />
            <span>
              <span className="font-medium">{CATEGORY_LABELS[skip.category]}</span> not checked: {skip.reason}
            </span>
          </div>
        ))}

        <p className="px-1 text-xs text-text-faint">
          Room sizes follow the National Building Code of India 2016 minimums; Vastu follows common practice. Your
          local building bye-laws may differ; they’ll be checked in a later step.
        </p>
      </div>
    </SidePanel>
  )
}
