import { describe, expect, it, vi } from 'vitest'
import type { AuthResponseDto } from '../authApi'
import { DEMO_ARCHITECT_EMAIL, DEMO_EMAIL, DEMO_PASSWORD } from '../dataMode'
import type { ProjectDetailDto, ProjectDto } from '../projectsApi'
import type { ReviewDetailDto, ReviewQuoteDto, ReviewSummaryDto } from '../reviewsApi'

// The API client reads the saved session when it loads, so storage must exist first.
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
})
const { handleDemoRequest } = await import('.')

async function login(email: string) {
  const auth = (await handleDemoRequest('POST', '/auth/login', { email, password: DEMO_PASSWORD }, null)) as AuthResponseDto
  return auth.access_token
}

const call = <T,>(token: string, method: 'GET' | 'POST', path: string, body?: unknown) => handleDemoRequest(method, path, body, token) as Promise<T>

describe('demo architect reviews', () => {
  it('runs a review from request to approval, like the backend', async () => {
    const owner = await login(DEMO_EMAIL)
    const architect = await login(DEMO_ARCHITECT_EMAIL)
    const me = (await call<{ role: string }>(architect, 'GET', '/auth/me')).role
    expect(me).toBe('architect')

    const quote = await call<ReviewQuoteDto>(owner, 'GET', '/reviews/quote')
    expect([quote.fee, quote.tax, quote.total]).toEqual([4999, 900, 5899])

    const [project] = await call<ProjectDto[]>(owner, 'GET', '/projects')
    const requested = await call<ReviewDetailDto>(owner, 'POST', `/projects/${project.id}/reviews`, { note: 'Check the stairs' })
    expect(requested.status).toBe('awaiting_payment')
    expect(requested.snapshot.rooms.length).toBeGreaterThan(0)
    await expect(call(owner, 'POST', `/projects/${project.id}/reviews`, {})).rejects.toMatchObject({ status: 409 })
    expect(await call<ReviewSummaryDto[]>(architect, 'GET', '/reviews')).toEqual([])

    const paid = await call<ReviewDetailDto>(owner, 'POST', `/reviews/${requested.id}/pay`, { method: 'simulated' })
    expect(paid.status).toBe('queued')
    expect(paid.payment_reference).toMatch(/^SIM-/)
    expect((await call<ProjectDetailDto>(owner, 'GET', `/projects/${project.id}`)).status).toBe('in_review')

    const queue = await call<ReviewSummaryDto[]>(architect, 'GET', '/reviews')
    expect(queue.map((r) => r.id)).toEqual([requested.id])
    expect(queue[0].requester.name).toBe('Sandeep Gowda')

    await call(architect, 'POST', `/reviews/${requested.id}/claim`)
    const roomId = requested.snapshot.rooms[0].id
    await call(architect, 'POST', `/reviews/${requested.id}/comments`, { body: 'Widen this door.', room_id: roomId })
    const replied = await call<ReviewDetailDto>(owner, 'POST', `/reviews/${requested.id}/comments`, { body: 'Done.' })
    expect(replied.comments.map((c) => [c.author?.role, c.room_id])).toEqual([
      ['architect', roomId],
      ['customer', null],
    ])
    await expect(call(owner, 'POST', `/reviews/${requested.id}/cancel`)).rejects.toMatchObject({ status: 409 })

    const done = await call<ReviewDetailDto>(architect, 'POST', `/reviews/${requested.id}/complete`, { outcome: 'approved', summary: 'Good to build.' })
    expect([done.status, done.outcome]).toEqual(['completed', 'approved'])
    expect((await call<ProjectDetailDto>(owner, 'GET', `/projects/${project.id}`)).status).toBe('ready')
    const history = await call<ReviewDetailDto[]>(owner, 'GET', `/projects/${project.id}/reviews`)
    expect(history.map((r) => r.status)).toEqual(['completed'])
  })

  it("keeps customers out of other people's reviews and architect actions", async () => {
    const owner = await login(DEMO_EMAIL)
    const [, project] = await call<ProjectDto[]>(owner, 'GET', '/projects')
    const review = await call<ReviewDetailDto>(owner, 'POST', `/projects/${project.id}/reviews`, {})
    const stranger = ((await handleDemoRequest('POST', '/auth/signup', { name: 'Stranger', email: 'stranger@example.com', password: 'supersecret1' }, null)) as AuthResponseDto)
      .access_token
    await expect(call(stranger, 'GET', `/reviews/${review.id}`)).rejects.toMatchObject({ status: 404 })
    await call(owner, 'POST', `/reviews/${review.id}/pay`, {})
    await expect(call(stranger, 'POST', `/reviews/${review.id}/claim`)).rejects.toMatchObject({ status: 404 })
    await expect(call(owner, 'POST', `/reviews/${review.id}/claim`)).rejects.toMatchObject({ status: 403 })
  })
})
