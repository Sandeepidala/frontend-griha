import { apiRequest } from './apiClient'
import { setSession } from './session'
import type { AccountType, AuthUser } from '@/types/auth'

export interface UserDto {
  id: string
  name: string
  email: string
  phone: string | null
  avatar_url: string | null
  account_type: AccountType
  provider: AuthUser['provider']
  email_verified: boolean
  /** Missing from sessions saved before architect reviews existed. */
  role?: AuthUser['role']
}

export interface AuthResponseDto {
  access_token: string
  refresh_token: string
  user: UserDto
}

function mapUser(dto: UserDto): AuthUser {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    phone: dto.phone ?? undefined,
    avatarUrl: dto.avatar_url ?? undefined,
    accountType: dto.account_type,
    provider: dto.provider,
    emailVerified: dto.email_verified,
    role: dto.role ?? 'customer',
  }
}

function applyAuthResponse(dto: AuthResponseDto): AuthUser {
  setSession({ accessToken: dto.access_token, refreshToken: dto.refresh_token })
  return mapUser(dto.user)
}

export async function signup(input: {
  name: string
  email: string
  password: string
  accountType: AccountType
}): Promise<AuthUser> {
  const dto = await apiRequest<AuthResponseDto>('/auth/signup', {
    method: 'POST',
    auth: false,
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
      account_type: input.accountType,
    },
  })
  return applyAuthResponse(dto)
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const dto = await apiRequest<AuthResponseDto>('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  })
  return applyAuthResponse(dto)
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const dto = await apiRequest<UserDto>('/auth/me')
  return mapUser(dto)
}

/** Sets a new password. Every other device is signed out; this one continues with new tokens. */
export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthUser> {
  const dto = await apiRequest<AuthResponseDto>('/auth/change-password', {
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword },
  })
  return applyAuthResponse(dto)
}

/** Revokes every session of this account, on every device including this one. */
export async function logoutEverywhere(): Promise<void> {
  await apiRequest('/auth/logout-all', { method: 'POST' })
}

/** Everything the platform holds about the signed-in user (projects, plans, reviews, messages). */
export async function exportMyData(): Promise<unknown> {
  return apiRequest<unknown>('/auth/me/export')
}

/** Permanently deletes the account and all its projects. Accounts without a password confirm with their email. */
export async function deleteAccount(confirmation: { password?: string; confirmEmail?: string }): Promise<void> {
  await apiRequest('/auth/me', {
    method: 'DELETE',
    body: { password: confirmation.password ?? null, confirm_email: confirmation.confirmEmail ?? null },
  })
}

/** Demo mode only: gives a simulated provider sign-in (Google, SSO, phone OTP…) a real session. */
export async function demoProviderSignIn(user: AuthUser): Promise<AuthUser> {
  const dto = await apiRequest<AuthResponseDto>('/auth/demo-provider', {
    method: 'POST',
    auth: false,
    body: {
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      provider: user.provider,
      account_type: user.accountType,
    },
  })
  return applyAuthResponse(dto)
}

/** Demo mode only: applies a new password from the forgot-password flow. */
export async function demoResetPassword(email: string, password: string): Promise<void> {
  await apiRequest('/auth/demo-reset-password', { method: 'POST', auth: false, body: { email, password } })
}
