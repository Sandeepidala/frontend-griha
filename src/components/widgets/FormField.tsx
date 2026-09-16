import { type ReactElement, cloneElement, isValidElement, useId } from 'react'
import { cn } from '@/lib/cn'

interface ControlProps {
  id?: string
  invalid?: boolean
  required?: boolean
  'aria-invalid'?: boolean
  'aria-describedby'?: string
}

export interface FormFieldProps {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactElement<ControlProps>
  className?: string
}

export function FormField({ label, hint, error, required, children, className }: FormFieldProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  const extraProps: ControlProps = {
    id,
    invalid: !!error,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  }
  if (required) extraProps.required = true

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {isValidElement(children) ? cloneElement(children, extraProps) : children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
