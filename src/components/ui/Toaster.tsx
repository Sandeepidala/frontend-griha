import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { type ToastItem, useToastStore } from '@/stores/useToastStore'

const DISMISS_AFTER_MS = 4000

const config = {
  info: { icon: Info, wrap: 'border-info/30 bg-info-soft', icon_c: 'text-info' },
  success: { icon: CheckCircle2, wrap: 'border-success/30 bg-success-soft', icon_c: 'text-success' },
  warning: { icon: AlertTriangle, wrap: 'border-warning/30 bg-warning-soft', icon_c: 'text-warning' },
  danger: { icon: XCircle, wrap: 'border-danger/30 bg-danger-soft', icon_c: 'text-danger' },
}

function ToastCard({ item }: { item: ToastItem }) {
  const removeToast = useToastStore((state) => state.removeToast)
  const { icon: Icon, wrap, icon_c } = config[item.variant]

  useEffect(() => {
    const timeout = setTimeout(() => removeToast(item.id), DISMISS_AFTER_MS)
    return () => clearTimeout(timeout)
  }, [item.id, removeToast])

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex w-[min(360px,calc(100vw-2rem))] items-start gap-2.5 rounded-sm border p-3 shadow-lg',
        'animate-[modal-in_.15s_ease-out]',
        wrap,
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', icon_c)} aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-text">{item.message}</p>
      <button
        type="button"
        onClick={() => removeToast(item.id)}
        aria-label="Dismiss"
        className="shrink-0 rounded-sm p-0.5 text-text-faint transition-colors hover:text-text"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-4"
      style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))' }}
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  )
}
