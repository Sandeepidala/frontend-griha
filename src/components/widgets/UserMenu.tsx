import type { ComponentType } from 'react'
import { LayoutDashboard, LogOut, Settings, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Divider } from '@/components/ui/Divider'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/stores/useAuthStore'

export function UserMenu() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const signOut = useAuthStore((state) => state.signOut)

  const name = user?.name ?? 'Account'
  const email = user?.email || user?.phone || ''

  return (
    <Popover
      align="end"
      panelClassName="w-[min(260px,calc(100vw-2rem))] p-1.5"
      trigger={
        <button
          type="button"
          aria-label="Account menu"
          className={cn(
            'flex items-center rounded-full p-0.5 transition-colors',
            'hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          )}
        >
          <Avatar name={name} src={user?.avatarUrl} size="sm" />
        </button>
      }
    >
      {(close) => (
        <div className="flex flex-col">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-text">{name}</p>
            {email && <p className="truncate text-xs text-text-muted">{email}</p>}
          </div>
          <Divider className="my-1" />
          <MenuItem
            icon={LayoutDashboard}
            label="Dashboard"
            onClick={() => {
              navigate('/')
              close()
            }}
          />
          <MenuItem
            icon={User}
            label="Profile"
            onClick={() => {
              close()
            }}
          />
          <MenuItem
            icon={Settings}
            label="Settings"
            onClick={() => {
              navigate('/settings')
              close()
            }}
          />
          <Divider className="my-1" />
          <MenuItem
            icon={LogOut}
            label="Log out"
            tone="danger"
            onClick={() => {
              signOut()
              navigate('/sign-in', { replace: true })
              close()
            }}
          />
        </div>
      )}
    </Popover>
  )
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  tone?: 'danger'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2',
        tone === 'danger' ? 'text-danger' : 'text-text',
      )}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}
