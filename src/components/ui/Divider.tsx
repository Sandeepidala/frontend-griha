import { cn } from '@/lib/cn'

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical'
  label?: string
  className?: string
}

export function Divider({ orientation = 'horizontal', label, className }: DividerProps) {
  if (orientation === 'vertical') {
    return <span className={cn('w-px self-stretch bg-border', className)} role="separator" aria-orientation="vertical" />
  }

  if (label) {
    return (
      <div className={cn('flex items-center gap-3 text-xs text-text-faint', className)} role="separator">
        <span className="h-px flex-1 bg-border" />
        {label}
        <span className="h-px flex-1 bg-border" />
      </div>
    )
  }

  return <hr className={cn('border-0 border-t border-border', className)} />
}
