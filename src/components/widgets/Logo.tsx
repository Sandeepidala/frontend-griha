import { cn } from '@/lib/cn'

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span className="font-display text-lg font-semibold text-text">Griha</span>
    </div>
  )
}
