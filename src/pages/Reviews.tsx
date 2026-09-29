import { AlertTriangle, ClipboardCheck, Clock, Inbox, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container } from '@/components/layout/Container'
import { Navbar } from '@/components/layout/Navbar'
import { ReviewStatusBadge } from '@/components/reviews/ReviewParts'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/widgets/EmptyState'
import { StatCard } from '@/components/widgets/StatCard'
import { ApiError } from '@/lib/apiError'
import { formatDate, isOverdue } from '@/lib/reviews'
import { listReviews } from '@/lib/reviewsApi'
import { useAuthStore } from '@/stores/useAuthStore'
import type { ReviewSummary } from '@/types/review'

function ReviewRow({ review, onOpen, showCustomer, now }: { review: ReviewSummary; onOpen: () => void; showCustomer: boolean; now: number }) {
  const overdue = isOverdue(review, now)
  return (
    <Card className="cursor-pointer transition-colors hover:border-border-strong" onClick={onOpen}>
      <CardBody className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display font-semibold text-text">{review.projectName}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {[review.plotLabel, review.location, showCustomer ? review.requester.name : review.architect?.name].filter(Boolean).join(' · ')}
          </p>
          <p className={`mt-0.5 text-xs ${overdue ? 'text-danger' : 'text-text-faint'}`}>
            {review.status === 'completed'
              ? `Completed ${formatDate(review.completedAt)}`
              : review.dueAt
                ? `Due ${formatDate(review.dueAt)}${overdue ? ' (overdue)' : ''}`
                : `Requested ${formatDate(review.createdAt)}`}
          </p>
        </div>
        <ReviewStatusBadge review={review} />
      </CardBody>
    </Card>
  )
}

/**
 * Architects' review desk: the queue of paid requests and the reviews they've taken on. Customers
 * see their own requests here too, each linking back to its project.
 */
export function Reviews() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const isArchitect = user?.role === 'architect'
  const [reviews, setReviews] = useState<ReviewSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // When the page opened: what counts as overdue.
  const [now] = useState(() => Date.now())

  useEffect(() => {
    listReviews()
      .then(setReviews)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Couldn't load reviews."))
  }, [])

  const open = (review: ReviewSummary) => navigate(isArchitect && review.requester.id !== user?.id ? `/reviews/${review.id}` : `/projects/${review.projectId}`)

  const queue = (reviews ?? []).filter((r) => r.status === 'queued' && r.requester.id !== user?.id)
  const mine = (reviews ?? []).filter((r) => r.architect?.id === user?.id)
  const active = mine.filter((r) => r.status === 'in_review')
  const done = mine.filter((r) => r.status === 'completed')
  const requested = (reviews ?? []).filter((r) => r.requester.id === user?.id)

  const sections = isArchitect
    ? [
        { title: 'Waiting for an architect', items: queue, empty: 'No paid requests are waiting.' },
        { title: 'Your reviews in progress', items: active, empty: 'Take on a request from the queue to start.' },
        { title: 'Completed', items: done, empty: 'Nothing completed yet.' },
      ]
    : [{ title: 'Your review requests', items: requested, empty: '' }]

  return (
    <div className="min-h-svh bg-bg">
      <Navbar />
      <Container className="py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">{isArchitect ? 'Design reviews' : 'Architect reviews'}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {isArchitect
              ? 'Take on a paid request, comment on the plan, then approve it or ask for changes.'
              : 'Reviews you have requested. Open a project to follow its review or request a new one.'}
          </p>
        </div>

        {!reviews && !error && (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        )}
        {error && <EmptyState icon={AlertTriangle} title="Couldn't load reviews" description={error} className="mx-auto max-w-lg" />}

        {reviews && (
          <>
            {isArchitect && (
              <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard label="In the queue" value={queue.length} icon={Inbox} />
                <StatCard label="In progress" value={active.length} icon={Clock} />
                <StatCard label="Completed" value={done.length} icon={ClipboardCheck} />
              </div>
            )}
            {!isArchitect && requested.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No reviews yet"
                description="Open a project and choose Architect review to have a qualified architect check your design."
                action={<Button onClick={() => navigate('/')}>Go to projects</Button>}
                className="mx-auto max-w-lg"
              />
            ) : (
              <div className="flex flex-col gap-8">
                {sections.map((section) => (
                  <section key={section.title} className="flex flex-col gap-3">
                    <h2 className="font-display text-sm font-semibold text-text">
                      {section.title} <span className="font-normal text-text-faint">({section.items.length})</span>
                    </h2>
                    {section.items.length === 0 ? (
                      <p className="text-sm text-text-muted">{section.empty}</p>
                    ) : (
                      section.items.map((review) => <ReviewRow key={review.id} review={review} onOpen={() => open(review)} showCustomer={isArchitect} now={now} />)
                    )}
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </Container>
    </div>
  )
}
