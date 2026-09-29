export type AccountType = 'homeowner' | 'builder' | 'nri'

/** Architects are vetted professionals who review customers' designs; the role is set by the team. */
export type UserRole = 'customer' | 'architect'

export type AuthProvider = 'password' | 'google' | 'facebook' | 'apple' | 'phone' | 'sso'

export interface AuthUser {
  id: string
  name: string
  email: string
  phone?: string
  avatarUrl?: string
  accountType: AccountType
  provider: AuthProvider
  emailVerified: boolean
  role: UserRole
}

export interface SignUpInput {
  name: string
  email: string
  password: string
  accountType: AccountType
}
