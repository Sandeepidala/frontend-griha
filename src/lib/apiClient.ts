import { ApiError } from './apiError'
import { DEMO_MODE } from './dataMode'
import { clearSession, getAccessToken, getRefreshToken, setSession } from './session'

export { ApiError }

const BASE_URL = import.meta.env.VITE_API_BASE_URL
const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.'

let sessionExpiredHandler: (() => void) | null = null

export function setSessionExpiredHandler(handler: () => void) {
  sessionExpiredHandler = handler
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  const response = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
  if (!response.ok) return false

  const tokens = await response.json()
  setSession({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token })
  return true
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body.detail === 'string') return body.detail
  } catch {
    // response had no JSON body
  }
  return response.statusText || 'Something went wrong.'
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  auth?: boolean
}

async function demoRequest<T>(path: string, { method = 'GET', body, auth = true }: RequestOptions): Promise<T> {
  const { handleDemoRequest } = await import('./demoBackend')
  try {
    return (await handleDemoRequest(method, path, body, auth ? getAccessToken() : null)) as T
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && auth) {
      clearSession()
      sessionExpiredHandler?.()
      throw new ApiError(401, SESSION_EXPIRED_MESSAGE)
    }
    throw err
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (DEMO_MODE) return demoRequest<T>(path, options)

  const { method = 'GET', body, auth = true } = options

  async function send(): Promise<Response> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (auth) {
      const token = getAccessToken()
      if (token) headers.Authorization = `Bearer ${token}`
    }
    return fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  let response = await send()

  if (response.status === 401 && auth) {
    const refreshed = await refreshAccessToken()
    if (refreshed) {
      response = await send()
    } else {
      clearSession()
      sessionExpiredHandler?.()
      throw new ApiError(401, SESSION_EXPIRED_MESSAGE)
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseErrorMessage(response))
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
