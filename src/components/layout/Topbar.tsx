import type { ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/cn'

export interface TopbarProps {
  onMenuClick?: () => void
  brand: ReactNode
  actions?: ReactNode
  className?: string
}

export function Topbar({ onMenuClick, brand, actions, className }: TopbarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-sm sm:px-6',
        className,
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      {onMenuClick && (
        <IconButton label="Toggle navigation" onClick={onMenuClick} className="lg:hidden">
          <Menu className="size-5" />
        </IconButton>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2">{brand}</div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </header>
  )
}
