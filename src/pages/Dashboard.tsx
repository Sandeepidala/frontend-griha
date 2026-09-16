import { Building2, CheckCircle2, Clock, FolderKanban, IndianRupee, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Container } from '@/components/layout/Container'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { EmptyState } from '@/components/widgets/EmptyState'
import { ProjectStatusBadge } from '@/components/widgets/ProjectStatusBadge'
import { StatCard } from '@/components/widgets/StatCard'
import { formatCurrency } from '@/lib/format'
import { useProjectsStore } from '@/stores/useProjectsStore'

export function Dashboard() {
  const navigate = useNavigate()
  const projects = useProjectsStore((state) => state.projects)
  const activityLog = useProjectsStore((state) => state.activityLog)
  const setActiveProject = useProjectsStore((state) => state.setActiveProject)
  const openNewProjectPanel = useProjectsStore((state) => state.openNewProjectPanel)

  if (projects.length === 0) {
    return (
      <div className="min-h-svh bg-bg">
        <Navbar />
        <Container className="flex min-h-[calc(100svh-3rem)] flex-col justify-center py-10">
          <EmptyState
            icon={Building2}
            title="No projects yet"
            description="Start your first residential design — enter your plot size, budget and room requirements, or ask the AI assistant to get you started."
            action={<Button onClick={openNewProjectPanel}>New project</Button>}
            className="mx-auto w-full max-w-lg border-none py-0"
          />
        </Container>
      </div>
    )
  }

  const inProgress = projects.filter((p) => p.status === 'draft' || p.status === 'generating' || p.status === 'in_review')
  const ready = projects.filter((p) => p.status === 'ready')
  const avgBudget = projects.reduce((sum, p) => sum + p.budget, 0) / projects.length

  function openProject(id: string) {
    setActiveProject(id)
    navigate(`/projects/${id}`)
  }

  return (
    <div className="min-h-svh bg-bg">
      <Navbar />
      <Container className="py-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-text-muted">An overview of every residential design in progress.</p>
          </div>
          <Button onClick={openNewProjectPanel}>New project</Button>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total projects" value={projects.length} icon={FolderKanban} />
          <StatCard label="In progress" value={inProgress.length} icon={Clock} />
          <StatCard label="Avg. budget" value={formatCurrency(avgBudget)} icon={IndianRupee} />
          <StatCard label="Ready for review" value={ready.length} icon={CheckCircle2} />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-3 lg:col-span-2">
            <h2 className="font-display text-sm font-semibold text-text">Projects</h2>
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer transition-colors hover:border-border-strong"
                onClick={() => openProject(project.id)}
              >
                <CardBody className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display font-semibold text-text">{project.name}</p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {project.plotWidth}' × {project.plotHeight}' · {formatCurrency(project.budget)} ·{' '}
                      {project.facing[0].toUpperCase() + project.facing.slice(1)}-facing
                    </p>
                  </div>
                  <ProjectStatusBadge status={project.status} />
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="font-display text-sm font-semibold text-text">Recent activity</h2>
            <Card>
              <CardBody className="flex flex-col gap-4">
                {activityLog.map((entry) => (
                  <div key={entry.id} className="flex gap-2.5">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <Sparkles className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-text">{entry.message}</p>
                      <p className="text-xs text-text-faint">{entry.time}</p>
                    </div>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        </div>
      </Container>
    </div>
  )
}
