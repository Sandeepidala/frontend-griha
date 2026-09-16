export type AccountType = 'homeowner' | 'builder' | 'nri'

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
}

export interface SignUpInput {
  name: string
  email: string
  password: string
  accountType: AccountType
}
