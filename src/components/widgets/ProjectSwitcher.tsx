import { ChevronDown, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Divider } from '@/components/ui/Divider'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/cn'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { ProjectStatusBadge } from './ProjectStatusBadge'

export function ProjectSwitcher() {
  const projects = useProjectsStore((state) => state.projects)
  const activeProjectId = useProjectsStore((state) => state.activeProjectId)
  const setActiveProject = useProjectsStore((state) => state.setActiveProject)
  const openNewProjectPanel = useProjectsStore((state) => state.openNewProjectPanel)
  const navigate = useNavigate()

  const active = projects.find((project) => project.id === activeProjectId)

  return (
    <Popover
      align="start"
      panelClassName="w-80 p-1.5"
      trigger={
        <button
          type="button"
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-text transition-colors',
            'hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          )}
        >
          <span className="max-w-[9rem] truncate sm:max-w-[14rem]">{active ? active.name : 'Select project'}</span>
          <ChevronDown className="size-4 shrink-0 text-text-muted" />
        </button>
      }
    >
      {(close) => (
        <div className="flex flex-col">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wide text-text-faint uppercase">
            Your projects
          </div>
          <div className="max-h-72 overflow-y-auto">
            {projects.length === 0 && (
              <p className="px-3 py-4 text-sm text-text-muted">No projects yet.</p>
            )}
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  setActiveProject(project.id)
                  navigate(`/projects/${project.id}`)
                  close()
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2',
                  project.id === activeProjectId ? 'bg-surface-2 text-text' : 'text-text',
                )}
              >
                <span className="min-w-0 truncate">{project.name}</span>
                <ProjectStatusBadge status={project.status} />
              </button>
            ))}
          </div>
          <Divider className="my-1" />
          <button
            type="button"
            onClick={() => {
              openNewProjectPanel()
              close()
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-primary transition-colors hover:bg-surface-2"
          >
            <Plus className="size-4" />
            New project
          </button>
        </div>
      )}
    </Popover>
  )
}
