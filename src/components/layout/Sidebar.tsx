import type { ComponentType } from 'react'
import { cn } from '@/lib/cn'

export interface NavItem {
  label: string
  href: string
  icon: ComponentType<{ className?: string }>
}

export interface SidebarProps {
  items: NavItem[]
  activeHref: string
  onNavigate: (href: string) => void
  header?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function Sidebar({ items, activeHref, onNavigate, header, footer, className }: SidebarProps) {
  return (
    <nav className={cn('flex h-full flex-col bg-surface', className)} aria-label="Primary">
      {header && <div className="shrink-0 border-b border-border px-4 py-4">{header}</div>}
      <ul className="flex-1 space-y-1 overflow-y-auto p-3">
        {items.map((item) => {
          const Icon = item.icon
          const active = item.href === activeHref
          return (
            <li key={item.href}>
              <a
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={(event) => {
                  event.preventDefault()
                  onNavigate(item.href)
                }}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
                  active
                    ? 'bg-primary-soft text-primary'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text',
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
      {footer && <div className="shrink-0 border-t border-border px-4 py-3">{footer}</div>}
    </nav>
  )
}
