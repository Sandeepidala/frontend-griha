import { apiRequest } from './apiClient'
import { type ProjectDetailDto, mapDetail } from './projectsApi'
import type { Review, ReviewComment, ReviewOutcome, ReviewParty, ReviewQuote, ReviewStatus, ReviewSummary } from '@/types/review'

export interface ReviewPartyDto {
  id: string
  name: string
  role: ReviewParty['role']
}

export interface ReviewCommentDto {
  id: string
  author: ReviewPartyDto | null
  body: string
  room_id: string | null
  created_at: string
}

export interface ReviewSummaryDto {
  id: string
  project_id: string
  status: ReviewStatus
  outcome: ReviewOutcome | null
  customer_note: string | null
  summary: string | null
  fee: number
  tax: number
  total: number
  payment_reference: string | null
  paid_at: string | null
  due_at: string | null
  claimed_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  requester: ReviewPartyDto
  architect: ReviewPartyDto | null
  project_name: string
  plot_label: string
  location: string | null
}

export interface ReviewDetailDto extends ReviewSummaryDto {
  snapshot: ProjectDetailDto
  comments: ReviewCommentDto[]
}

export interface ReviewQuoteDto {
  fee: number
  tax: number
  total: number
  tax_rate: number
  turnaround_days: number
  payments: 'simulated'
}

function mapComment(dto: ReviewCommentDto): ReviewComment {
  return { id: dto.id, author: dto.author, body: dto.body, roomId: dto.room_id, createdAt: dto.created_at }
}

function mapSummary(dto: ReviewSummaryDto): ReviewSummary {
  return {
    id: dto.id,
    projectId: dto.project_id,
    status: dto.status,
    outcome: dto.outcome,
    customerNote: dto.customer_note,
    summary: dto.summary,
    fee: dto.fee,
    tax: dto.tax,
    total: dto.total,
    paymentReference: dto.payment_reference,
    paidAt: dto.paid_at,
    dueAt: dto.due_at,
    claimedAt: dto.claimed_at,
    completedAt: dto.completed_at,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    requester: dto.requester,
    architect: dto.architect,
    projectName: dto.project_name,
    plotLabel: dto.plot_label,
    location: dto.location,
  }
}

function mapReview(dto: ReviewDetailDto): Review {
  return { ...mapSummary(dto), snapshot: mapDetail(dto.snapshot), comments: dto.comments.map(mapComment) }
}

export async function getReviewQuote(): Promise<ReviewQuote> {
  const dto = await apiRequest<ReviewQuoteDto>('/reviews/quote')
  return { fee: dto.fee, tax: dto.tax, total: dto.total, taxRate: dto.tax_rate, turnaroundDays: dto.turnaround_days, payments: dto.payments }
}

/** A customer's own requests; for an architect, the open queue and the reviews assigned to them. */
export async function listReviews(): Promise<ReviewSummary[]> {
  return (await apiRequest<ReviewSummaryDto[]>('/reviews')).map(mapSummary)
}

export async function listProjectReviews(projectId: string): Promise<Review[]> {
  return (await apiRequest<ReviewDetailDto[]>(`/projects/${projectId}/reviews`)).map(mapReview)
}

export async function requestReview(projectId: string, note: string): Promise<Review> {
  return mapReview(await apiRequest<ReviewDetailDto>(`/projects/${projectId}/reviews`, { method: 'POST', body: { note: note.trim() || null } }))
}

export async function getReview(reviewId: string): Promise<Review> {
  return mapReview(await apiRequest<ReviewDetailDto>(`/reviews/${reviewId}`))
}

export async function payForReview(reviewId: string): Promise<Review> {
  return mapReview(await apiRequest<ReviewDetailDto>(`/reviews/${reviewId}/pay`, { method: 'POST', body: { method: 'simulated' } }))
}

export async function cancelReview(reviewId: string): Promise<Review> {
  return mapReview(await apiRequest<ReviewDetailDto>(`/reviews/${reviewId}/cancel`, { method: 'POST' }))
}

export async function claimReview(reviewId: string): Promise<Review> {
  return mapReview(await apiRequest<ReviewDetailDto>(`/reviews/${reviewId}/claim`, { method: 'POST' }))
}

export async function commentOnReview(reviewId: string, body: string, roomId: string | null = null): Promise<Review> {
  return mapReview(
    await apiRequest<ReviewDetailDto>(`/reviews/${reviewId}/comments`, { method: 'POST', body: { body: body.trim(), room_id: roomId } }),
  )
}

export async function completeReview(reviewId: string, outcome: ReviewOutcome, summary: string): Promise<Review> {
  return mapReview(
    await apiRequest<ReviewDetailDto>(`/reviews/${reviewId}/complete`, { method: 'POST', body: { outcome, summary: summary.trim() } }),
  )
}
