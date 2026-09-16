import { cn } from '@/lib/cn'

export interface ProgressBarProps {
  value: number
  max?: number
  label?: string
  showValue?: boolean
  variant?: 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}

const variantStyles = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  variant = 'primary',
  className,
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-text-muted">
          {label && <span>{label}</span>}
          {showValue && <span className="font-mono tabular-nums">{Math.round(pct)}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-2 w-full overflow-hidden rounded-sm bg-surface-2"
      >
        <div
          className={cn('h-full rounded-sm transition-[width] duration-300 ease-out', variantStyles[variant])}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
