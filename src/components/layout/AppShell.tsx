import { type ReactNode, useState } from 'react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { type NavItem, Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export interface AppShellProps {
  navItems: NavItem[]
  activeHref: string
  onNavigate: (href: string) => void
  brand: ReactNode
  sidebarHeader?: ReactNode
  sidebarFooter?: ReactNode
  topbarActions?: ReactNode
  children: ReactNode
}

export function AppShell({
  navItems,
  activeHref,
  onNavigate,
  brand,
  sidebarHeader,
  sidebarFooter,
  topbarActions,
  children,
}: AppShellProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const [open, setOpen] = useState(false)

  function handleNavigate(href: string) {
    onNavigate(href)
    setOpen(false)
  }

  return (
    <div className="min-h-svh bg-bg">
      <div className="flex min-h-svh">
        <div
          className={cn(
            'fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-surface transition-transform duration-200 ease-out',
            'lg:static lg:z-auto lg:translate-x-0',
            open ? 'translate-x-0' : '-translate-x-full',
          )}
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <Sidebar
            items={navItems}
            activeHref={activeHref}
            onNavigate={handleNavigate}
            header={sidebarHeader}
            footer={sidebarFooter}
            className="h-full"
          />
        </div>

        {open && !isDesktop && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-text/40 lg:hidden"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenuClick={() => setOpen((v) => !v)} brand={brand} actions={topbarActions} />
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
