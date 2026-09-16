import type { ReactNode } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'

export interface SocialButtonProps {
  icon: ReactNode
  label: string
  onClick: () => void
  isLoading?: boolean
  disabled?: boolean
  variant?: 'full' | 'compact'
}

export function SocialButton({ icon, label, onClick, isLoading, disabled, variant = 'full' }: SocialButtonProps) {
  const content = isLoading ? <Spinner size="sm" /> : <span className="flex size-[18px] shrink-0 items-center">{icon}</span>

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isLoading}
        aria-label={`Continue with ${label}`}
        title={`Continue with ${label}`}
        className={cn(
          'flex h-10 w-full items-center justify-center rounded-sm border border-border-strong bg-surface transition-colors',
          'hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          'disabled:pointer-events-none disabled:opacity-50',
        )}
      >
        {content}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'flex h-10 w-full items-center justify-center gap-2.5 rounded-sm border border-border-strong bg-surface text-sm font-medium text-text transition-colors',
        'hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        'disabled:pointer-events-none disabled:opacity-50',
      )}
    >
      {content}
      {label}
    </button>
  )
}
