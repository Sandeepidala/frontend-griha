import { ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Divider } from '@/components/ui/Divider'
import { AiChatPanel } from '@/components/widgets/AiChatPanel'
import { Logo } from '@/components/widgets/Logo'
import { ProjectBriefPanel } from '@/components/widgets/ProjectBriefPanel'
import { ProjectSwitcher } from '@/components/widgets/ProjectSwitcher'
import { ThemeToggle } from '@/components/widgets/ThemeToggle'
import { UserMenu } from '@/components/widgets/UserMenu'
import { useAuthStore } from '@/stores/useAuthStore'

export function Navbar() {
  const isArchitect = useAuthStore((state) => state.user?.role === 'architect')
  return (
    <header
      className="sticky top-0 z-30 flex h-12 items-center gap-1 border-b border-border bg-surface px-4 sm:px-6"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <Logo />
      <Divider orientation="vertical" className="mx-0.5 h-5" />
      <ProjectSwitcher />
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        {isArchitect && (
          <Link
            to="/reviews"
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <ShieldCheck className="size-4" />
            <span className="hidden sm:inline">Reviews</span>
          </Link>
        )}
        <ThemeToggle />
        <AiChatPanel />
        <UserMenu />
      </div>
      <ProjectBriefPanel />
    </header>
  )
}
