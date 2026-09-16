import { type InputHTMLAttributes, forwardRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export type CheckboxProps = InputHTMLAttributes<HTMLInputElement>

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <span className={cn('relative inline-flex size-[18px] shrink-0', className)}>
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          'peer absolute inset-0 size-full cursor-pointer appearance-none rounded-sm border border-border-strong bg-surface transition-colors',
          'checked:border-primary checked:bg-primary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...props}
      />
      <Check
        className="pointer-events-none relative m-auto size-3 text-on-primary opacity-0 peer-checked:opacity-100"
        aria-hidden="true"
        strokeWidth={3}
      />
    </span>
  ),
)
Checkbox.displayName = 'Checkbox'
