import { type ReactNode, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeStyles = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className={cn(
        // Tailwind's preflight zeroes margin globally, which breaks the native
        // dialog's built-in `margin: auto` centering — m-auto restores it. Portalled
        // to <body> so a transformed ancestor can't break this dialog's centering.
        'm-auto w-[calc(100%-2rem)] rounded-lg border border-border bg-surface p-0 text-text shadow-lg',
        'backdrop:bg-text/40 backdrop:backdrop-blur-[2px]',
        'open:animate-[modal-in_.15s_ease-out]',
        sizeStyles[size],
      )}
    >
      {(title || description) && (
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="font-display text-lg font-semibold text-text">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} size="sm" className="-mt-1 -mr-1">
            <X className="size-4" />
          </IconButton>
        </div>
      )}
      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
    </dialog>,
    document.body,
  )
}
