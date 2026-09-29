import { AlertTriangle, ArrowLeft, BadgeCheck, CircleAlert, ListChecks } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ExportMenu } from '@/components/drawings/ExportMenu'
import { SHEET_COMPONENTS } from '@/components/drawings/renderSheet'
import { Navbar } from '@/components/layout/Navbar'
import { Callout, CommentThread, ReviewStatusBadge } from '@/components/reviews/ReviewParts'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RadioGroup } from '@/components/ui/Radio'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { EmptyState } from '@/components/widgets/EmptyState'
import { ApiError } from '@/lib/apiError'
import { describeBrief } from '@/lib/brief'
import { estimateBoq, formatLakhs } from '@/lib/boq'
import { CATEGORY_LABELS, runDesignCheck, scoreVariant } from '@/lib/designCheck'
import { type SheetDef, buildDrawingSet, sheetRegister } from '@/lib/drawings/sheets'
import { formatDate } from '@/lib/reviews'
import * as reviewsApi from '@/lib/reviewsApi'
import { useAuthStore } from '@/stores/useAuthStore'
import { toast } from '@/stores/useToastStore'
import type { Plot } from '@/types/design'
import type { ProjectDetail } from '@/types/project'
import type { Review, ReviewOutcome } from '@/types/review'

const plotOf = (s: ProjectDetail): Plot => ({ width: s.plotWidth, height: s.plotHeight, facing: s.facing, units: s.units, setbacks: s.setbacks })
const budgetOf = (s: ProjectDetail) => ({ amount: s.budget, turnkey: s.turnkey })

function message(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback
}

/** The architect's desk for one review: the plan as submitted, the automatic checks, the conversation and the verdict. */
export function ReviewWorkspace() {
  const { id } = useParams<{ id: string }>()
  const user = useAuthStore((state) => state.user)
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    reviewsApi
      .getReview(id)
      .then(setReview)
      .catch((err) => setError(message(err, "Couldn't load this review.")))
  }, [id])

  if (error) {
    return (
      <div className="min-h-svh bg-bg">
        <Navbar />
        <EmptyState
          icon={AlertTriangle}
          title="Review not available"
          description={error}
          action={
            <Link to="/reviews">
              <Button>Back to reviews</Button>
            </Link>
          }
          className="mx-auto mt-16 max-w-lg"
        />
      </div>
    )
  }
  if (!review || !user) {
    return (
      <div className="min-h-svh bg-bg">
        <Navbar />
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }
  return <ReviewDesk review={review} userId={user.id} onChange={setReview} />
}

function ReviewDesk({ review, userId, onChange }: { review: Review; userId: string; onChange: (review: Review) => void }) {
  const { snapshot } = review
  const mine = review.architect?.id === userId
  const [busy, setBusy] = useState<'claim' | 'complete' | null>(null)
  const [outcome, setOutcome] = useState<ReviewOutcome>('approved')
  const [summary, setSummary] = useState('')

  const architectName = review.architect?.name ?? 'Griha'
  const set = useMemo(
    () => buildDrawingSet(plotOf(snapshot), snapshot.floors, snapshot.name, architectName, { brief: snapshot.brief, budget: budgetOf(snapshot) }),
    [snapshot, architectName],
  )
  const register = useMemo(() => sheetRegister(snapshot.floors), [snapshot.floors])
  // Every 2D sheet, the per-floor ones once for each floor.
  const pages = useMemo(() => {
    const out: { key: string; label: string; sheet: SheetDef; floorId: string }[] = []
    for (const sheet of register) {
      if (sheet.is3d) continue
      if (sheet.perFloor && set.models.length > 1) {
        set.models.forEach((m, i) => {
          const code = `${sheet.code}${String.fromCharCode(65 + i)}`
          out.push({ key: `${sheet.id}:${m.floor.id}`, label: `${code} ${sheet.title} — ${m.floor.name}`, sheet: { ...sheet, code }, floorId: m.floor.id })
        })
      } else {
        out.push({ key: sheet.id, label: `${sheet.code} ${sheet.title}`, sheet, floorId: sheet.floorId ?? set.models[0]?.floor.id ?? '' })
      }
    }
    return out
  }, [register, set])
  const [pageKey, setPageKey] = useState(() => pages.find((p) => p.sheet.kind === 'floor-plan')?.key ?? pages[0]?.key)
  const page = pages.find((p) => p.key === pageKey) ?? pages[0]
  const Sheet = page ? SHEET_COMPONENTS[page.sheet.kind] : undefined

  const checks = useMemo(() => {
    const plot = plotOf(snapshot)
    const estimate = estimateBoq({ plot, floors: snapshot.floors, brief: snapshot.brief, budget: budgetOf(snapshot) })
    const report = runDesignCheck({
      plot,
      floors: snapshot.floors,
      brief: snapshot.brief,
      cost: { estimate: estimate.total, budget: snapshot.budget, turnkey: estimate.includeInteriors },
    })
    // Failures first, then warnings.
    const issues = report.results.filter((r) => r.status !== 'pass').sort((a, b) => Number(b.status === 'fail') - Number(a.status === 'fail'))
    return { estimate, report, issues }
  }, [snapshot])

  async function act(kind: 'claim' | 'complete', action: () => Promise<Review>, done: string) {
    setBusy(kind)
    try {
      onChange(await action())
      toast.success(done)
    } catch (err) {
      toast.danger(message(err, 'Something went wrong. Try again.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex h-svh flex-col bg-bg">
      <Navbar />
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-2.5 sm:px-6">
        <Link to="/reviews" className="flex items-center gap-1 text-sm text-text-muted hover:text-text">
          <ArrowLeft className="size-4" /> Reviews
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display font-semibold text-text">{review.projectName}</h1>
          <p className="truncate text-xs text-text-muted">
            {[review.requester.name, review.plotLabel, review.location, describeBrief(snapshot.brief), `budget ${formatLakhs(snapshot.budget)}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <ReviewStatusBadge review={review} />
        {review.dueAt && review.status !== 'completed' && <span className="text-xs text-text-muted">Due {formatDate(review.dueAt)}</span>}
        <div className="flex-1" />
        {review.status === 'queued' && (
          <Button size="sm" isLoading={busy === 'claim'} onClick={() => act('claim', () => reviewsApi.claimReview(review.id), 'Review is yours. The customer can see you have started.')}>
            Take on this review
          </Button>
        )}
        {page && <ExportMenu set={set} register={register} sheet={page.sheet} floorId={page.floorId} />}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2 sm:px-6">
            <span className="text-xs text-text-muted">Sheet</span>
            <div className="w-80 max-w-full">
              <Select selectSize="sm" value={page?.key} onChange={(e) => setPageKey(e.target.value)} aria-label="Sheet">
                {pages.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <span className="ml-auto hidden text-xs text-text-faint sm:inline">As submitted {formatDate(review.createdAt)}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-surface-2 p-4 sm:p-6">
            {Sheet && page && (
              <div className="mx-auto max-w-[1400px] bg-white shadow-lg ring-1 ring-black/10 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full">
                <Sheet set={set} sheet={page.sheet} floorId={page.floorId} />
              </div>
            )}
          </div>
        </div>

        <aside className="flex min-h-0 w-full shrink-0 flex-col gap-5 overflow-y-auto border-t border-border bg-surface p-4 sm:p-5 lg:w-[420px] lg:border-t-0 lg:border-l">
          {review.customerNote && (
            <Callout title="The customer asks">
              <p className="whitespace-pre-wrap">{review.customerNote}</p>
            </Callout>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
              <ListChecks className="size-4" /> Automatic checks
              <Badge variant={scoreVariant(checks.report.score)} className="ml-auto font-mono tabular-nums">
                {checks.report.score}
              </Badge>
            </h2>
            <p className="text-xs text-text-muted">
              The platform's rule checks on this plan, to confirm or overrule. Estimate {formatLakhs(checks.estimate.total)} against a budget of{' '}
              {formatLakhs(snapshot.budget)}.
            </p>
            {checks.issues.length === 0 ? (
              <p className="text-sm text-success">Every automatic check passes.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {checks.issues.map((issue) => (
                  <li key={issue.id} className="flex gap-2 text-sm">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${issue.status === 'fail' ? 'bg-danger' : 'bg-warning'}`} aria-label={issue.status} />
                    <span>
                      <span className="text-text">{issue.title}</span>
                      <span className="text-xs text-text-faint"> · {CATEGORY_LABELS[issue.category]}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {review.status !== 'queued' && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-text">Conversation with {review.requester.name}</h2>
              <CommentThread
                review={review}
                viewerId={userId}
                canComment={mine}
                roomPicker
                onSend={async (body, roomId) => onChange(await reviewsApi.commentOnReview(review.id, body, roomId))}
                placeholder="Comment on the design, or pick a room to pin it to…"
              />
            </section>
          )}

          {mine && review.status === 'in_review' && (
            <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <h2 className="text-sm font-semibold text-text">Verdict</h2>
              <RadioGroup
                name="outcome"
                value={outcome}
                onChange={(value) => setOutcome(value as ReviewOutcome)}
                options={[
                  { value: 'approved', label: 'Approve', description: 'Good to finalise and build as drawn.' },
                  { value: 'changes_requested', label: 'Request changes', description: 'The customer should revise the design first.' },
                ]}
              />
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Summary for the customer: what works, and what to change…"
                aria-label="Summary for the customer"
              />
              <Button
                disabled={!summary.trim()}
                isLoading={busy === 'complete'}
                onClick={() => act('complete', () => reviewsApi.completeReview(review.id, outcome, summary), 'Verdict sent to the customer.')}
              >
                Send verdict
              </Button>
            </section>
          )}

          {review.status === 'completed' && (
            <Callout
              variant={review.outcome === 'approved' ? 'success' : 'warning'}
              title={review.outcome === 'approved' ? 'You approved this design' : 'You requested changes'}
              icon={review.outcome === 'approved' ? <BadgeCheck className="size-4" /> : <CircleAlert className="size-4" />}
            >
              <p className="whitespace-pre-wrap">{review.summary}</p>
              <p className="mt-1 text-xs">{formatDate(review.completedAt)}</p>
            </Callout>
          )}
        </aside>
      </div>
    </div>
  )
}
