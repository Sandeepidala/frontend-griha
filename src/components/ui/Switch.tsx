import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

export type SwitchProps = InputHTMLAttributes<HTMLInputElement>

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <label className={cn('relative inline-flex h-6 w-11 shrink-0 cursor-pointer', className)}>
      <input ref={ref} type="checkbox" role="switch" className="peer sr-only" {...props} />
      <span
        className={cn(
          'absolute inset-0 rounded-full bg-border-strong transition-colors duration-150',
          'peer-checked:bg-primary',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus-ring',
          'peer-disabled:opacity-50',
        )}
      />
      <span
        className={cn(
          'pointer-events-none absolute top-[3px] left-[3px] size-[18px] rounded-full bg-white shadow-sm transition-transform duration-150',
          'peer-checked:translate-x-5',
        )}
      />
    </label>
  ),
)
Switch.displayName = 'Switch'
