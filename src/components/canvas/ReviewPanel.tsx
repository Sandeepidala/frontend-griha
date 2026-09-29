import { BadgeCheck, CircleAlert, Clock, CreditCard, History, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Callout, CommentThread, FeeBreakdown, ReviewStatusBadge } from '@/components/reviews/ReviewParts'
import { formatDate } from '@/lib/reviews'
import { Button } from '@/components/ui/Button'
import { SidePanel } from '@/components/ui/SidePanel'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { ApiError } from '@/lib/apiError'
import * as reviewsApi from '@/lib/reviewsApi'
import { useAuthStore } from '@/stores/useAuthStore'
import { flushSaves, useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { toast } from '@/stores/useToastStore'
import type { Review, ReviewQuote } from '@/types/review'

interface ReviewPanelProps {
  open: boolean
  onClose: () => void
  /** Reports the latest review, so the toolbar can show its status. */
  onChange?: (review: Review | null) => void
}

const ACTIVE = ['awaiting_payment', 'queued', 'in_review']

const STEPS = [
  { key: 'awaiting_payment', label: 'Requested' },
  { key: 'queued', label: 'Paid' },
  { key: 'in_review', label: 'Reviewing' },
  { key: 'completed', label: 'Done' },
] as const

function Steps({ review }: { review: Review }) {
  const at = STEPS.findIndex((s) => s.key === review.status)
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Review progress">
      {STEPS.map((step, i) => (
        <li key={step.key} className="flex flex-col gap-1">
          <span className={`h-1 rounded-full ${i <= at ? 'bg-primary' : 'bg-surface-2'}`} />
          <span className={`text-[11px] ${i <= at ? 'font-medium text-text' : 'text-text-faint'}`}>{step.label}</span>
        </li>
      ))}
    </ol>
  )
}

function message(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback
}

/**
 * Architect review for the customer (project document §7): request a paid review of this design,
 * follow it, and talk to the architect. The architect sees the plan as it was when requested.
 */
export function ReviewPanel({ open, onClose, onChange }: ReviewPanelProps) {
  const projectId = useDesignStore((state) => state.projectId)
  const floors = useDesignStore((state) => state.floors)
  const setActiveFloorId = useDesignStore((state) => state.setActiveFloorId)
  const select = useDesignStore((state) => state.select)
  const fetchProjects = useProjectsStore((state) => state.fetchProjects)
  const userId = useAuthStore((state) => state.user?.id ?? '')
  const emailsOn = useAuthStore((state) => state.user?.emailNotifications ?? false)
  const [reviews, setReviews] = useState<Review[] | null>(null)
  const [quote, setQuote] = useState<ReviewQuote | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<'request' | 'pay' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasRooms = floors.some((f) => f.rooms.length > 0)

  // Load with the project (the toolbar shows the status) and again on opening: the architect may have replied.
  useEffect(() => {
    if (!projectId) return
    let current = true
    Promise.all([reviewsApi.listProjectReviews(projectId), reviewsApi.getReviewQuote()])
      .then(([list, q]) => {
        if (!current) return
        setReviews(list)
        setQuote(q)
        setError(null)
      })
      .catch((err) => current && setError(message(err, "Couldn't load reviews.")))
    return () => {
      current = false
    }
  }, [projectId, open])

  const latest = reviews?.[0] ?? null
  useEffect(() => {
    onChange?.(latest)
  }, [latest, onChange])

  const active = latest && ACTIVE.includes(latest.status) ? latest : null
  // The review shown in full: the one in progress, else the last completed one.
  const current = active ?? (latest?.status === 'completed' ? latest : null)
  const past = (reviews ?? []).filter((r) => r !== current)

  function replace(review: Review) {
    setReviews((list) => [review, ...(list ?? []).filter((r) => r.id !== review.id)])
  }

  async function run(kind: 'request' | 'pay' | 'cancel', action: () => Promise<Review>, done: string) {
    setBusy(kind)
    try {
      replace(await action())
      toast.success(done)
      // Paying, cancelling and completing change the project's status on the dashboard.
      void fetchProjects()
    } catch (err) {
      toast.danger(message(err, 'Something went wrong. Try again.'))
    } finally {
      setBusy(null)
    }
  }

  async function handleRequest() {
    if (!projectId) return
    // The review copies the saved plan, so batched edits must reach the server first.
    await flushSaves()
    await run('request', () => reviewsApi.requestReview(projectId, note), 'Review requested. Pay the fee to send it to an architect.')
    setNote('')
  }

  function showRoom(roomId: string) {
    const floor = floors.find((f) => f.rooms.some((r) => r.id === roomId))
    if (!floor) {
      toast.info('That room has changed since the review; it is no longer in the plan.')
      return
    }
    setActiveFloorId(floor.id)
    select({ type: 'room', id: roomId })
  }

  return (
    <SidePanel open={open} onClose={onClose} title="Architect review" description="A qualified architect checks your design before you build" defaultWidth={440}>
      <div className="flex flex-col gap-4 px-5 py-4">
        {!reviews && !error && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {error && (
          <Callout variant="danger" title="Couldn't load reviews">
            {error}
          </Callout>
        )}


        {reviews && !active && (
          <section className="flex flex-col gap-4">
            {current && (
              <CompletedReview
                review={current}
                userId={userId}
                onRoomClick={showRoom}
                onSend={async (body) => replace(await reviewsApi.commentOnReview(current.id, body))}
              />
            )}

            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <h3 className="font-semibold text-text">{latest?.status === 'completed' ? 'Request another review' : 'Get an expert opinion'}</h3>
              </div>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-text-muted">
                <li>An architect checks the layout, room sizes, light, structure and bye-law compliance.</li>
                <li>Comments are pinned to rooms, and you can reply.</li>
                <li>You get a clear verdict: approved to build, or the changes to make.</li>
              </ul>
              {quote && (
                <>
                  <FeeBreakdown fee={quote.fee} tax={quote.tax} total={quote.total} taxRate={quote.taxRate} />
                  <p className="flex items-center gap-1.5 text-xs text-text-muted">
                    <Clock className="size-3.5" /> Reply within {quote.turnaroundDays} days of payment. Fee and terms are placeholders.
                  </p>
                </>
              )}
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={4000}
                placeholder="Anything you'd like the architect to look at? (optional)"
                aria-label="Note for the architect"
              />
              {!hasRooms && <p className="text-sm text-warning">Add rooms or generate a plan first.</p>}
              <Button onClick={handleRequest} isLoading={busy === 'request'} disabled={!hasRooms || !projectId}>
                Request review
              </Button>
            </div>
          </section>
        )}

        {active && (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-text-muted">Requested {formatDate(active.createdAt)}</span>
                <ReviewStatusBadge review={active} />
              </div>
              <Steps review={active} />
              {active.status === 'awaiting_payment' && (
                <>
                  <FeeBreakdown fee={active.fee} tax={active.tax} total={active.total} taxRate={quote?.taxRate} />
                  <Callout variant="info" title="Test payments">
                    No payment gateway is connected yet, so paying is simulated and nothing is charged.
                  </Callout>
                  <Button
                    onClick={() => run('pay', () => reviewsApi.payForReview(active.id), 'Payment received. An architect will pick up your review shortly.')}
                    isLoading={busy === 'pay'}
                    leftIcon={<CreditCard className="size-4" />}
                  >
                    Pay {active.total.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                  </Button>
                </>
              )}
              {active.status === 'queued' && (
                <p className="text-sm text-text-muted">
                  Paid (ref {active.paymentReference}). An architect will pick this up; expect a reply by {formatDate(active.dueAt)}.
                </p>
              )}
              {active.status === 'in_review' && active.architect && (
                <p className="text-sm text-text-muted">
                  <span className="font-medium text-text">{active.architect.name}</span> is reviewing your design. Reply due by {formatDate(active.dueAt)}.
                </p>
              )}
              {active.customerNote && (
                <p className="rounded-md bg-surface-2 px-3 py-2 text-sm text-text-muted">
                  <span className="font-medium text-text">Your note:</span> {active.customerNote}
                </p>
              )}
              {(active.status === 'awaiting_payment' || active.status === 'queued') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start text-danger"
                  isLoading={busy === 'cancel'}
                  onClick={() => run('cancel', () => reviewsApi.cancelReview(active.id), 'Review cancelled.')}
                >
                  Cancel request
                </Button>
              )}
              <p className="text-xs text-text-faint">
                The architect sees your plan as it was when you requested the review. Changes you make now aren't included.
                {emailsOn && active.status !== 'awaiting_payment' && " We'll email you when the architect starts, comments and replies."}
              </p>
            </div>

            {active.status !== 'awaiting_payment' && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-text">Conversation</h3>
                <CommentThread
                  review={active}
                  viewerId={userId}
                  canComment
                  onRoomClick={showRoom}
                  onSend={async (body) => replace(await reviewsApi.commentOnReview(active.id, body))}
                  placeholder="Ask the architect a question…"
                />
              </div>
            )}
          </section>
        )}

        {past.length > 0 && (
          <section className="mt-2 flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-text">
              <History className="size-4" /> Earlier reviews
            </h3>
            <ul className="flex flex-col gap-1.5">
              {past.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span className="text-text-muted">
                    {formatDate(r.createdAt)}
                    {r.architect ? ` · ${r.architect.name}` : ''}
                  </span>
                  <ReviewStatusBadge review={r} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </SidePanel>
  )
}

function CompletedReview({
  review,
  userId,
  onRoomClick,
  onSend,
}: {
  review: Review
  userId: string
  onRoomClick: (roomId: string) => void
  onSend: (body: string) => Promise<void>
}) {
  const approved = review.outcome === 'approved'
  return (
    <div className="flex flex-col gap-3">
      <Callout
        variant={approved ? 'success' : 'warning'}
        title={approved ? 'Approved by the architect' : 'The architect suggests changes'}
        icon={approved ? <BadgeCheck className="size-4" /> : <CircleAlert className="size-4" />}
      >
        <p className="whitespace-pre-wrap">{review.summary}</p>
        <p className="mt-1 text-xs opacity-80">
          {review.architect?.name ?? 'Architect'} · {formatDate(review.completedAt)}
        </p>
      </Callout>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-text">Comments</h3>
        <CommentThread review={review} viewerId={userId} canComment onRoomClick={onRoomClick} onSend={onSend} placeholder="Reply to the architect…" />
      </div>
    </div>
  )
}
