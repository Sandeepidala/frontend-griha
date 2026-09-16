import { type SelectHTMLAttributes, forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  selectSize?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: 'h-8 text-[13px] pl-2.5 pr-7',
  md: 'h-10 text-sm pl-3 pr-8',
  lg: 'h-12 text-base pl-4 pr-9',
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, selectSize = 'md', children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full appearance-none rounded-md border bg-surface text-text transition-colors',
          'border-border-strong',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid && 'border-danger',
          sizeStyles[selectSize],
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-text-faint"
        aria-hidden="true"
      />
    </div>
  ),
)
Select.displayName = 'Select'
