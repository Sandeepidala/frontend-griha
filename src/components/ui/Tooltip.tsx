import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface TooltipProps {
  content: string
  children: ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

const placementStyles = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
}

export function Tooltip({ content, children, placement = 'top', className }: TooltipProps) {
  return (
    <span className={cn('group relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 scale-95 rounded-sm bg-text px-2 py-1 text-xs whitespace-nowrap text-bg opacity-0 shadow-md transition-[opacity,transform] duration-100',
          'group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100',
          placementStyles[placement],
        )}
      >
        {content}
      </span>
    </span>
  )
}
