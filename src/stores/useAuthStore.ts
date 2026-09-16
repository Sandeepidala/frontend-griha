import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthProvider, AuthUser, SignUpInput } from '@/types/auth'

interface RegisteredUser {
  email: string
  password: string
  user: AuthUser
}

interface AuthState {
  user: AuthUser | null
  status: 'idle' | 'authenticating'
  registeredUsers: RegisteredUser[]
  pendingResetEmail: string | null
  signInWithPassword: (email: string, password: string) => Promise<void>
  signUpWithPassword: (input: SignUpInput) => Promise<void>
  signInWithProvider: (provider: Extract<AuthProvider, 'google' | 'facebook' | 'apple'>) => Promise<void>
  signInWithSso: (workEmail: string) => Promise<void>
  requestOtp: (phone: string) => Promise<void>
  verifyOtp: (phone: string, code: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  resetPassword: (newPassword: string) => Promise<void>
  signOut: () => void
}

export const DEMO_EMAIL = 'sandeep.gowda@movingwalls.com'
export const DEMO_PASSWORD = 'griha1234'

const DEMO_USER: AuthUser = {
  id: 'demo-user',
  name: 'Sandeep Gowda',
  email: DEMO_EMAIL,
  accountType: 'builder',
  provider: 'password',
  emailVerified: true,
}

const SOCIAL_PROFILES: Record<string, Pick<AuthUser, 'name' | 'email'>> = {
  google: { name: 'Ananya Kapoor', email: 'ananya.kapoor@gmail.com' },
  facebook: { name: 'Rahul Mehta', email: 'rahul.mehta@outlook.com' },
  apple: { name: 'Divya Nair', email: 'divya.nair@icloud.com' },
}

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `user-${Date.now()}`
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      status: 'idle',
      registeredUsers: [{ email: DEMO_EMAIL, password: DEMO_PASSWORD, user: DEMO_USER }],
      pendingResetEmail: null,

      signInWithPassword: async (email, password) => {
        set({ status: 'authenticating' })
        await delay(700)
        const match = get().registeredUsers.find(
          (entry) => entry.email.toLowerCase() === email.trim().toLowerCase(),
        )
        if (!match) {
          set({ status: 'idle' })
          throw new Error('No account found with that email. Check the address or sign up.')
        }
        if (match.password !== password) {
          set({ status: 'idle' })
          throw new Error('Incorrect password. Try again or reset it.')
        }
        set({ user: match.user, status: 'idle' })
      },

      signUpWithPassword: async ({ name, email, password, accountType }) => {
        set({ status: 'authenticating' })
        await delay(800)
        const exists = get().registeredUsers.some(
          (entry) => entry.email.toLowerCase() === email.trim().toLowerCase(),
        )
        if (exists) {
          set({ status: 'idle' })
          throw new Error('An account with this email already exists. Try signing in instead.')
        }
        const user: AuthUser = {
          id: createId(),
          name: name.trim(),
          email: email.trim(),
          accountType,
          provider: 'password',
          emailVerified: false,
        }
        set((state) => ({
          registeredUsers: [...state.registeredUsers, { email: user.email, password, user }],
          user,
          status: 'idle',
        }))
      },

      signInWithProvider: async (provider) => {
        set({ status: 'authenticating' })
        await delay(900)
        const profile = SOCIAL_PROFILES[provider]
        const existing = get().registeredUsers.find((entry) => entry.email === profile.email)
        const user: AuthUser =
          existing?.user ??
          ({
            id: createId(),
            name: profile.name,
            email: profile.email,
            accountType: 'homeowner',
            provider,
            emailVerified: true,
          } satisfies AuthUser)
        if (!existing) {
          set((state) => ({
            registeredUsers: [...state.registeredUsers, { email: user.email, password: '', user }],
          }))
        }
        set({ user, status: 'idle' })
      },

      signInWithSso: async (workEmail) => {
        set({ status: 'authenticating' })
        await delay(1200)
        const user: AuthUser = {
          id: createId(),
          name: (workEmail.split('@')[0] || 'Team member').replace(/[._]/g, ' '),
          email: workEmail.trim(),
          accountType: 'builder',
          provider: 'sso',
          emailVerified: true,
        }
        set({ user, status: 'idle' })
      },

      requestOtp: async () => {
        set({ status: 'authenticating' })
        await delay(600)
        set({ status: 'idle' })
      },

      verifyOtp: async (phone, code) => {
        set({ status: 'authenticating' })
        await delay(700)
        if (code !== '123456') {
          set({ status: 'idle' })
          throw new Error('Incorrect code. Use 123456 for this demo.')
        }
        const existing = get().registeredUsers.find((entry) => entry.user.phone === phone)
        const user: AuthUser =
          existing?.user ??
          ({
            id: createId(),
            name: 'Guest User',
            email: '',
            phone,
            accountType: 'homeowner',
            provider: 'phone',
            emailVerified: false,
          } satisfies AuthUser)
        if (!existing) {
          set((state) => ({
            registeredUsers: [...state.registeredUsers, { email: '', password: '', user }],
          }))
        }
        set({ user, status: 'idle' })
      },

      requestPasswordReset: async (email) => {
        set({ status: 'authenticating' })
        await delay(700)
        set({ status: 'idle', pendingResetEmail: email.trim() })
      },

      resetPassword: async (newPassword) => {
        set({ status: 'authenticating' })
        await delay(700)
        const email = get().pendingResetEmail
        set((state) => ({
          status: 'idle',
          pendingResetEmail: null,
          registeredUsers: state.registeredUsers.map((entry) =>
            email && entry.email.toLowerCase() === email.toLowerCase()
              ? { ...entry, password: newPassword }
              : entry,
          ),
        }))
      },

      signOut: () => set({ user: null }),
    }),
    {
      name: 'griha-auth',
      partialize: (state) => ({ user: state.user, registeredUsers: state.registeredUsers }),
    },
  ),
)
