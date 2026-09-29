import { describe, expect, it, vi } from 'vitest'
import type { AuthResponseDto } from '../authApi'
import type { ProjectDto } from '../projectsApi'

// The API client reads the saved session when it loads, so storage must exist first.
const storage = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
})
const { handleDemoRequest } = await import('.')

const PASSWORD = 'supersecret1'
const send = (method: 'GET' | 'POST' | 'DELETE', path: string, token: string | null, body?: unknown) => handleDemoRequest(method, path, body, token)

async function signup(email: string) {
  return (await send('POST', '/auth/signup', null, { name: 'Tester', email, password: PASSWORD })) as AuthResponseDto
}

describe('demo account security and privacy', () => {
  it('changes the password and ends other sessions', async () => {
    const first = await signup('change@example.com')
    await expect(send('POST', '/auth/change-password', first.access_token, { current_password: 'nope', new_password: 'brand-new-pass' })).rejects.toMatchObject({
      status: 403,
    })
    const changed = (await send('POST', '/auth/change-password', first.access_token, {
      current_password: PASSWORD,
      new_password: 'brand-new-pass',
    })) as AuthResponseDto
    await expect(send('GET', '/auth/me', first.access_token)).rejects.toMatchObject({ status: 401 })
    expect(await send('GET', '/auth/me', changed.access_token)).toMatchObject({ email: 'change@example.com' })
    await expect(send('POST', '/auth/login', null, { email: 'change@example.com', password: PASSWORD })).rejects.toMatchObject({ status: 401 })
  })

  it('signs out everywhere', async () => {
    const auth = await signup('everywhere@example.com')
    await send('POST', '/auth/logout-all', auth.access_token)
    await expect(send('GET', '/auth/me', auth.access_token)).rejects.toMatchObject({ status: 401 })
  })

  it('exports and then deletes everything', async () => {
    const auth = await signup('leaving@example.com')
    const data = (await send('GET', '/auth/me/export', auth.access_token)) as { account: { email: string; password?: string }; projects: unknown[] }
    expect(data.account.email).toBe('leaving@example.com')
    expect(data.account.password).toBeUndefined()
    expect(data.projects.length).toBeGreaterThan(0)

    await expect(send('DELETE', '/auth/me', auth.access_token, { password: 'wrong' })).rejects.toMatchObject({ status: 403 })
    await send('DELETE', '/auth/me', auth.access_token, { password: PASSWORD })
    await expect(send('POST', '/auth/login', null, { email: 'leaving@example.com', password: PASSWORD })).rejects.toMatchObject({ status: 401 })
    // A new account with the same email starts empty apart from the sample projects.
    const again = await signup('leaving@example.com')
    const projects = (await send('GET', '/projects', again.access_token)) as ProjectDto[]
    expect(projects.length).toBe(data.projects.length)
  })

  it('keeps accepting sessions from before token versions', async () => {
    const auth = await signup('legacy@example.com')
    const legacy = auth.access_token.split('.').slice(0, 2).join('.')
    expect(await send('GET', '/auth/me', legacy)).toMatchObject({ email: 'legacy@example.com' })
  })
})
