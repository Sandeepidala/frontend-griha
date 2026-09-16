import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'

export interface AlertProps {
  open: boolean
  onClose?: () => void
  variant?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  children: ReactNode
}

const config = {
  info: { icon: Info, wrap: 'bg-info-soft border-info/30', icon_c: 'text-info' },
  success: { icon: CheckCircle2, wrap: 'bg-success-soft border-success/30', icon_c: 'text-success' },
  warning: { icon: AlertTriangle, wrap: 'bg-warning-soft border-warning/30', icon_c: 'text-warning' },
  danger: { icon: XCircle, wrap: 'bg-danger-soft border-danger/30', icon_c: 'text-danger' },
}

/** A blocking, page-centered alert box — for transient status updates use the Toaster instead. */
export function Alert({ open, onClose, variant = 'info', title, children }: AlertProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const { icon: Icon, wrap, icon_c } = config[variant]

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
        if (event.target === ref.current) onClose?.()
      }}
      className={cn(
        // Tailwind's preflight zeroes margin globally, which breaks the native
        // dialog's built-in `margin: auto` centering — m-auto restores it. Portalled
        // to <body> so a transformed ancestor (e.g. the resizable SidePanel) can't
        // turn this dialog's `position: fixed` into "centered within that panel".
        'm-auto w-[min(28rem,calc(100%-2rem))] rounded-sm border p-0 shadow-lg',
        'backdrop:bg-text/30 backdrop:backdrop-blur-[1px]',
        'open:animate-[modal-in_.15s_ease-out]',
        wrap,
      )}
    >
      <div role={variant === 'danger' || variant === 'warning' ? 'alert' : 'status'} className="flex gap-3 p-4">
        <Icon className={cn('mt-0.5 size-5 shrink-0', icon_c)} aria-hidden="true" />
        <div className="min-w-0 flex-1 text-sm">
          {title && <p className="font-medium text-text">{title}</p>}
          <div className="text-text-muted">{children}</div>
        </div>
        {onClose && (
          <IconButton label="Close" size="sm" variant="ghost" onClick={onClose} className="-mt-1 -mr-1 shrink-0">
            <X className="size-4" />
          </IconButton>
        )}
      </div>
    </dialog>,
    document.body,
  )
}
