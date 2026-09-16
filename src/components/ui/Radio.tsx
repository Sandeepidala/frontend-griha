import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

export type RadioProps = InputHTMLAttributes<HTMLInputElement>

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, ...props }, ref) => (
    <span className={cn('relative inline-flex size-[18px] shrink-0', className)}>
      <input
        ref={ref}
        type="radio"
        className={cn(
          'peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full border border-border-strong bg-surface transition-colors',
          'checked:border-[5px] checked:border-primary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...props}
      />
    </span>
  ),
)
Radio.displayName = 'Radio'

export interface RadioGroupProps {
  name: string
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string; description?: string; disabled?: boolean }[]
  disabled?: boolean
  className?: string
  orientation?: 'vertical' | 'horizontal'
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  disabled,
  className,
  orientation = 'vertical',
}: RadioGroupProps) {
  return (
    <div
      role="radiogroup"
      className={cn(
        'flex gap-3',
        orientation === 'vertical' ? 'flex-col' : 'flex-wrap items-center',
        className,
      )}
    >
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            'flex cursor-pointer items-start gap-2.5 text-sm',
            (disabled || opt.disabled) && 'cursor-not-allowed opacity-50',
          )}
        >
          <Radio
            name={name}
            value={opt.value}
            checked={value === opt.value}
            disabled={disabled || opt.disabled}
            onChange={() => onChange(opt.value)}
            className="mt-0.5"
          />
          <span>
            <span className="block text-text">{opt.label}</span>
            {opt.description && (
              <span className="block text-xs text-text-muted">{opt.description}</span>
            )}
          </span>
        </label>
      ))}
    </div>
  )
}
