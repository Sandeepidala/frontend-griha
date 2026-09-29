import type { Review } from '@/types/review'

export function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

/** Room names in the review's snapshot, for labelling and choosing what a comment is about. */
export function snapshotRooms(review: Review) {
  return review.snapshot.floors.flatMap((floor) =>
    floor.rooms.map((room) => ({ id: room.id, name: room.name, floorId: floor.id, floorName: floor.name })),
  )
}

/** Past its reply date and not yet completed. */
export function isOverdue(review: Pick<Review, 'dueAt' | 'status'>, now: number) {
  return !!review.dueAt && review.status !== 'completed' && review.status !== 'cancelled' && new Date(review.dueAt).getTime() < now
}
