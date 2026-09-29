import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as authApi from '@/lib/authApi'
import { ApiError } from '@/lib/apiClient'
import { DEMO_MODE } from '@/lib/dataMode'
import { clearSession } from '@/lib/session'
import { useProjectsStore } from '@/stores/useProjectsStore'
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

/**
 * Social, SSO and phone sign-in are simulated. In demo mode the in-browser backend still needs a
 * session for the account, as after a password sign-in, or loading its projects would fail.
 */
function withDemoSession(user: AuthUser): Promise<AuthUser> {
  return DEMO_MODE ? authApi.demoProviderSignIn(user) : Promise.resolve(user)
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      status: 'idle',
      registeredUsers: [],
      pendingResetEmail: null,

      signInWithPassword: async (email, password) => {
        set({ status: 'authenticating' })
        try {
          const user = await authApi.login(email.trim(), password)
          set({ user, status: 'idle' })
        } catch (err) {
          set({ status: 'idle' })
          throw new Error(err instanceof ApiError ? err.message : 'Could not reach the server.')
        }
      },

      signUpWithPassword: async ({ name, email, password, accountType }) => {
        set({ status: 'authenticating' })
        try {
          const user = await authApi.signup({ name: name.trim(), email: email.trim(), password, accountType })
          set({ user, status: 'idle' })
        } catch (err) {
          set({ status: 'idle' })
          throw new Error(err instanceof ApiError ? err.message : 'Could not reach the server.')
        }
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
            role: 'customer',
          } satisfies AuthUser)
        if (!existing) {
          set((state) => ({
            registeredUsers: [...state.registeredUsers, { email: user.email, password: '', user }],
          }))
        }
        set({ user: await withDemoSession(user), status: 'idle' })
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
          role: 'customer',
        }
        set({ user: await withDemoSession(user), status: 'idle' })
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
            role: 'customer',
          } satisfies AuthUser)
        if (!existing) {
          set((state) => ({
            registeredUsers: [...state.registeredUsers, { email: '', password: '', user }],
          }))
        }
        set({ user: await withDemoSession(user), status: 'idle' })
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
        if (DEMO_MODE && email) {
          try {
            await authApi.demoResetPassword(email, newPassword)
          } catch (err) {
            set({ status: 'idle' })
            throw new Error(err instanceof ApiError ? err.message : "Couldn't reset the password.")
          }
        }
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

      signOut: () => {
        clearSession()
        useProjectsStore.getState().reset()
        set({ user: null })
      },
    }),
    {
      name: 'griha-auth',
      partialize: (state) => ({ user: state.user, registeredUsers: state.registeredUsers }),
    },
  ),
)
