import { cn } from '@/lib/cn'

function scorePassword(password: string) {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  return Math.min(score, 4)
}

const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
const COLORS = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-info', 'bg-success']

export function PasswordStrengthMeter({ password }: { password: string }) {
  const score = scorePassword(password)

  if (!password) return null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-4 gap-1">
        {[0, 1, 2, 3].map((segment) => (
          <div
            key={segment}
            className={cn('h-1 rounded-sm bg-surface-2', segment < score && COLORS[score])}
          />
        ))}
      </div>
      <p className="text-xs text-text-muted">{LABELS[score]}</p>
    </div>
  )
}
