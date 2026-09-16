import { cn } from '@/lib/cn'

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizeStyles = { sm: 'size-4 border-2', md: 'size-6 border-2', lg: 'size-9 border-[3px]' }

export function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block animate-spin rounded-full border-border-strong border-t-primary',
        sizeStyles[size],
        className,
      )}
    />
  )
}
