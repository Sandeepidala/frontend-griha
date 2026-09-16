import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface TagProps {
  children: React.ReactNode
  onRemove?: () => void
  className?: string
}

export function Tag({ children, onRemove, className }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 py-1 pr-1 pl-2.5 text-[13px] text-text',
        className,
      )}
    >
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove"
          className="rounded-sm p-0.5 text-text-faint transition-colors hover:bg-border hover:text-text"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
