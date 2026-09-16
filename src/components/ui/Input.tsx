import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
  inputSize?: 'sm' | 'md' | 'lg'
}

const sizeStyles = {
  sm: 'h-8 text-[13px] px-2.5',
  md: 'h-10 text-sm px-3',
  lg: 'h-12 text-base px-4',
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, leftSlot, rightSlot, inputSize = 'md', disabled, ...props }, ref) => {
    if (leftSlot || rightSlot) {
      return (
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border bg-surface transition-colors',
            'border-border-strong focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring',
            invalid && 'border-danger',
            disabled && 'opacity-50',
            sizeStyles[inputSize],
            className,
          )}
        >
          {leftSlot && <span className="flex shrink-0 items-center text-text-faint [&_svg]:size-4">{leftSlot}</span>}
          <input
            ref={ref}
            disabled={disabled}
            className="min-w-0 flex-1 bg-transparent text-text placeholder:text-text-faint outline-none disabled:cursor-not-allowed"
            aria-invalid={invalid || undefined}
            {...props}
          />
          {rightSlot && <span className="flex shrink-0 items-center text-text-faint [&_svg]:size-4">{rightSlot}</span>}
        </div>
      )
    }

    return (
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full rounded-md border bg-surface text-text transition-colors',
          'border-border-strong placeholder:text-text-faint',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          invalid && 'border-danger',
          sizeStyles[inputSize],
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
