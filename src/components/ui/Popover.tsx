import { type ReactNode, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export interface PopoverProps {
  trigger: ReactNode
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: 'start' | 'end'
  /** Opens below the trigger, or above it (for a control at the bottom of the screen). */
  side?: 'bottom' | 'top'
  panelClassName?: string
}

export function Popover({ trigger, children, align = 'end', side = 'bottom', panelClassName }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative inline-flex">
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <div
          role="dialog"
          className={cn(
            'absolute z-40 overflow-hidden rounded-lg border border-border bg-surface shadow-lg',
            side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            'animate-[modal-in_.15s_ease-out]',
            align === 'end' ? 'right-0' : 'left-0',
            panelClassName,
          )}
        >
          {typeof children === 'function' ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  )
}
