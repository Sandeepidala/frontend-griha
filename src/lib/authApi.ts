import { apiRequest } from './apiClient'
import { setSession } from './session'
import type { AccountType, AuthUser } from '@/types/auth'

interface UserDto {
  id: string
  name: string
  email: string
  phone: string | null
  avatar_url: string | null
  account_type: AccountType
  provider: AuthUser['provider']
  email_verified: boolean
}

interface AuthResponseDto {
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
