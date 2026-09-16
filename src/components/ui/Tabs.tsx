import {
  type KeyboardEvent,
  type ReactNode,
  createContext,
  useContext,
  useId,
} from 'react'
import { cn } from '@/lib/cn'

interface TabsContextValue {
  value: string
  onChange: (value: string) => void
  baseId: string
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(component: string) {
  const ctx = useContext(TabsContext)
  if (!ctx) throw new Error(`<${component}> must be used inside <Tabs>`)
  return ctx
}

export interface TabsProps {
  value: string
  onChange: (value: string) => void
  children: ReactNode
  className?: string
}

export function Tabs({ value, onChange, children, className }: TabsProps) {
  const baseId = useId()
  return (
    <TabsContext.Provider value={{ value, onChange, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabList({ children, className }: { children: ReactNode; className?: string }) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'),
    )
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement)
    if (currentIndex === -1) return

    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1

    if (nextIndex !== null) {
      event.preventDefault()
      tabs[nextIndex].focus()
      tabs[nextIndex].click()
    }
  }

  return (
    <div
      role="tablist"
      onKeyDown={handleKeyDown}
      className={cn('inline-flex items-center gap-1 rounded-md bg-surface-2 p-1', className)}
    >
      {children}
    </div>
  )
}

export function Tab({ value: tabValue, children, disabled }: { value: string; children: ReactNode; disabled?: boolean }) {
  const { value, onChange, baseId } = useTabsContext('Tab')
  const selected = value === tabValue

  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${tabValue}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${tabValue}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => onChange(tabValue)}
      className={cn(
        'rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        selected ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  )
}

export function TabPanel({ value: tabValue, children, className }: { value: string; children: ReactNode; className?: string }) {
  const { value, baseId } = useTabsContext('TabPanel')
  if (value !== tabValue) return null

  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${tabValue}`}
      aria-labelledby={`${baseId}-tab-${tabValue}`}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  )
}
