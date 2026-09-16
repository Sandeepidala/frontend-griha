import type { ReactNode } from 'react'
import { AuthShowcase } from '@/components/widgets/AuthShowcase'
import { Logo } from '@/components/widgets/Logo'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-svh overflow-hidden">
      <AuthShowcase className="hidden w-[46%] shrink-0 lg:block" />
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-6 sm:px-10">
        <div className="w-full max-w-sm">
          <Logo className="mb-6 lg:hidden" />
          {children}
        </div>
      </div>
    </div>
  )
}
