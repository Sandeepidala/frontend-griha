import { MapPin, MessageSquare, Send } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/cn'
import { formatCurrency, formatRelativeTime } from '@/lib/format'
import { snapshotRooms } from '@/lib/reviews'
import type { Review, ReviewStatus, ReviewSummary } from '@/types/review'

const STATUS: Record<ReviewStatus, { label: string; variant: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'accent' }> = {
  awaiting_payment: { label: 'Awaiting payment', variant: 'warning' },
  queued: { label: 'Waiting for an architect', variant: 'primary' },
  in_review: { label: 'Architect reviewing', variant: 'accent' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'neutral' },
}

export function ReviewStatusBadge({ review }: { review: Pick<ReviewSummary, 'status' | 'outcome'> }) {
  if (review.status === 'completed' && review.outcome) {
    return review.outcome === 'approved' ? (
      <Badge variant="success" dot>
        Approved
      </Badge>
    ) : (
      <Badge variant="warning" dot>
        Changes requested
      </Badge>
    )
  }
  const { label, variant } = STATUS[review.status]
  return (
    <Badge variant={variant} dot>
      {label}
    </Badge>
  )
}

const CALLOUT = {
  info: 'border-info/30 bg-info-soft',
  success: 'border-success/30 bg-success-soft',
  warning: 'border-warning/30 bg-warning-soft',
  danger: 'border-danger/30 bg-danger-soft',
}

/** An inline note in a panel (ui/Alert is a blocking dialog). */
export function Callout({ variant = 'info', title, icon, children }: { variant?: keyof typeof CALLOUT; title?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={cn('rounded-md border px-3 py-2.5 text-sm text-text', CALLOUT[variant])}>
      {title && (
        <p className="mb-1 flex items-center gap-1.5 font-semibold">
          {icon}
          {title}
        </p>
      )}
      <div className="text-text-muted">{children}</div>
    </div>
  )
}

export function FeeBreakdown({ fee, tax, total, taxRate }: { fee: number; tax: number; total: number; taxRate?: number }) {
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
      <dt className="text-text-muted">Review fee</dt>
      <dd className="text-right font-mono tabular-nums text-text">{formatCurrency(fee)}</dd>
      <dt className="text-text-muted">GST{taxRate !== undefined ? ` (${Math.round(taxRate * 100)}%)` : ''}</dt>
      <dd className="text-right font-mono tabular-nums text-text">{formatCurrency(tax)}</dd>
      <dt className="border-t border-border pt-1 font-medium text-text">Total</dt>
      <dd className="border-t border-border pt-1 text-right font-mono font-semibold tabular-nums text-text">{formatCurrency(total)}</dd>
    </dl>
  )
}

interface CommentThreadProps {
  review: Review
  /** Who's reading, to label their own comments "You". */
  viewerId: string
  canComment: boolean
  onSend: (body: string, roomId: string | null) => Promise<void>
  /** Called when a room tag is clicked, e.g. to select that room in the editor. */
  onRoomClick?: (roomId: string) => void
  /** Offer a room picker (the architect tags comments to rooms). */
  roomPicker?: boolean
  placeholder?: string
}

export function CommentThread({ review, viewerId, canComment, onSend, onRoomClick, roomPicker, placeholder }: CommentThreadProps) {
  const [body, setBody] = useState('')
  const [roomId, setRoomId] = useState('')
  const [sending, setSending] = useState(false)
  const rooms = snapshotRooms(review)
  const roomLabel = (id: string) => {
    const room = rooms.find((r) => r.id === id)
    return room ? (review.snapshot.floors.length > 1 ? `${room.name} · ${room.floorName}` : room.name) : 'A room no longer in the plan'
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!body.trim()) return
    setSending(true)
    try {
      await onSend(body, roomId || null)
      setBody('')
      setRoomId('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {review.comments.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-text-muted">
          <MessageSquare className="size-4" /> No comments yet.
        </p>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {review.comments.map((comment) => {
            const mine = comment.author?.id === viewerId
            const architect = comment.author?.role === 'architect'
            return (
              <li
                key={comment.id}
                className={cn('rounded-md border px-3 py-2', architect ? 'border-accent/30 bg-accent-soft/40' : 'border-border bg-surface-2')}
              >
                <div className="mb-1 flex items-baseline gap-2 text-xs">
                  <span className="font-semibold text-text">{mine ? 'You' : (comment.author?.name ?? 'Former user')}</span>
                  {architect && <span className="text-accent">Architect</span>}
                  <span className="ml-auto text-text-faint">{formatRelativeTime(comment.createdAt)}</span>
                </div>
                {comment.roomId && (
                  <button
                    type="button"
                    onClick={() => onRoomClick?.(comment.roomId!)}
                    disabled={!onRoomClick}
                    className="mb-1 inline-flex items-center gap-1 rounded-sm bg-surface px-1.5 py-0.5 text-xs text-text-muted ring-1 ring-border enabled:hover:text-text"
                  >
                    <MapPin className="size-3" />
                    {roomLabel(comment.roomId)}
                  </button>
                )}
                <p className="text-sm whitespace-pre-wrap text-text">{comment.body}</p>
              </li>
            )
          })}
        </ol>
      )}

      {canComment && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={4000}
            placeholder={placeholder ?? 'Write a comment…'}
            aria-label="Comment"
          />
          <div className="flex items-center gap-2">
            {roomPicker && (
              <div className="min-w-0 flex-1">
                <Select selectSize="sm" value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="About a room">
                  <option value="">Whole design</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {roomLabel(room.id)}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Button type="submit" size="sm" className="ml-auto" isLoading={sending} disabled={!body.trim()} leftIcon={<Send className="size-4" />}>
              Send
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
