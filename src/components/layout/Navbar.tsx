import { Divider } from '@/components/ui/Divider'
import { AiChatPanel } from '@/components/widgets/AiChatPanel'
import { Logo } from '@/components/widgets/Logo'
import { NewProjectPanel } from '@/components/widgets/NewProjectPanel'
import { ProjectSwitcher } from '@/components/widgets/ProjectSwitcher'
import { ThemeToggle } from '@/components/widgets/ThemeToggle'
import { UserMenu } from '@/components/widgets/UserMenu'

export function Navbar() {
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
        <ThemeToggle />
        <AiChatPanel />
        <UserMenu />
      </div>
      <NewProjectPanel />
    </header>
  )
}
