import { type PointerEvent as ReactPointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'

const WIDTH_STORAGE_KEY = 'griha-panel-width'

export interface SidePanelProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  resizable?: boolean
}

function readStoredWidth(defaultWidth: number, min: number, max: number) {
  try {
    const stored = Number(localStorage.getItem(WIDTH_STORAGE_KEY))
    if (stored && stored >= min && stored <= max) return stored
  } catch {
    /* storage unavailable — fall back to default */
  }
  return defaultWidth
}

export function SidePanel({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  defaultWidth = 420,
  minWidth = 320,
  maxWidth = 720,
  resizable = true,
}: SidePanelProps) {
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const [width, setWidth] = useState(() => readStoredWidth(defaultWidth, minWidth, maxWidth))
  const draggingRef = useRef(false)

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!isDesktop) return
    event.preventDefault()
    draggingRef.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.classList.add('select-none')
    document.body.style.cursor = 'col-resize'
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    setWidth(Math.min(maxWidth, Math.max(minWidth, window.innerWidth - event.clientX)))
  }

  function stopDragging() {
    if (!draggingRef.current) return
    draggingRef.current = false
    document.body.classList.remove('select-none')
    document.body.style.cursor = ''
    setWidth((current) => {
      try {
        localStorage.setItem(WIDTH_STORAGE_KEY, String(current))
      } catch {
        /* storage unavailable — width just won't persist */
      }
      return current
    })
  }

  return (
    <div
      role="complementary"
      aria-label={title ?? 'Side panel'}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        'fixed inset-y-0 right-0 z-50 flex border-l border-border bg-surface shadow-lg',
        'transition-transform duration-200 ease-out',
        open ? 'translate-x-0' : 'translate-x-full',
      )}
      style={{ width: isDesktop ? `${width}px` : '100%' }}
    >
      {resizable && isDesktop && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          className="group absolute inset-y-0 left-0 z-10 w-3 -translate-x-1/2 cursor-col-resize touch-none"
        >
          <div className="mx-auto h-full w-px bg-transparent transition-colors group-hover:bg-primary" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {(title || description) && (
          <div
            className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4"
            style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
          >
            <div className="min-w-0">
              {title && <h2 className="font-display text-base font-semibold text-text">{title}</h2>}
              {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
            </div>
            <IconButton label="Close" onClick={onClose} size="sm" className="-mt-1 -mr-1">
              <X className="size-4" />
            </IconButton>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && (
          <div
            className="shrink-0 border-t border-border p-3"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
