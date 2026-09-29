import type { UserRole } from './auth'
import type { ProjectDetail } from './project'

/** A paid request for an architect to review a design (project document §7). */
export type ReviewStatus = 'awaiting_payment' | 'queued' | 'in_review' | 'completed' | 'cancelled'
export type ReviewOutcome = 'approved' | 'changes_requested'

export interface ReviewParty {
  id: string
  name: string
  role: UserRole
}

export interface ReviewComment {
  id: string
  author: ReviewParty | null
  body: string
  /** A room in the review's snapshot the comment is about. */
  roomId: string | null
  createdAt: string
}

export interface ReviewSummary {
  id: string
  projectId: string
  status: ReviewStatus
  outcome: ReviewOutcome | null
  customerNote: string | null
  summary: string | null
  fee: number
  tax: number
  total: number
  paymentReference: string | null
  paidAt: string | null
  dueAt: string | null
  claimedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  requester: ReviewParty
  architect: ReviewParty | null
  projectName: string
  plotLabel: string
  location: string | null
}

export interface Review extends ReviewSummary {
  /** The plan as it was when the review was requested. */
  snapshot: ProjectDetail
  comments: ReviewComment[]
}

export interface ReviewQuote {
  fee: number
  tax: number
  total: number
  taxRate: number
  turnaroundDays: number
  /** Only "simulated" until a payment gateway is connected. */
  payments: 'simulated'
}
