import { useEffect, useMemo, useState } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { PlanThumbnail } from '@/components/canvas/PlanThumbnail'
import { Badge } from '@/components/ui/Badge'
import { Card, CardBody } from '@/components/ui/Card'
import { ProjectStatusBadge } from '@/components/widgets/ProjectStatusBadge'
import { describeBrief, floorsLabel } from '@/lib/brief'
import { type BoqEstimate, estimateBoq, formatLakhs } from '@/lib/boq'
import { runDesignCheck, scoreVariant } from '@/lib/designCheck'
import { formatCurrency } from '@/lib/format'
import type { Floor, Plot } from '@/types/design'
import type { ProjectSummary } from '@/types/project'

const BUDGET_VARIANT = { within: 'success', close: 'warning', over: 'danger' } as const

interface ProjectCardProps {
  project: ProjectSummary
  /** The project's floors and rooms; undefined while they load. */
  floors: Floor[] | undefined
  /** Its place in the list: cards work out their scores one after another, not all in one go. */
  order: number
  onOpen: () => void
}

/** A project on the dashboard: its ground-floor plan, status, plot and budget, design score and estimate. */
export function ProjectCard({ project, floors, order, onOpen }: ProjectCardProps) {
  const plot: Plot = useMemo(
    () => ({ width: project.plotWidth, height: project.plotHeight, facing: project.facing, units: project.units, setbacks: project.setbacks }),
    [project.plotWidth, project.plotHeight, project.facing, project.units, project.setbacks],
  )
  const planned = (floors ?? []).filter((f) => f.rooms.length > 0).sort((a, b) => a.level - b.level)
  const ground = planned[0]
  const [preview, setPreview] = useState<{ key: Floor[]; score: number; estimate: BoqEstimate } | null>(null)

  useEffect(() => {
    if (!floors || !floors.some((f) => f.rooms.length > 0)) return
    // The cost estimate and design check take a few milliseconds each; spread them over frames.
    const timer = window.setTimeout(() => {
      const estimate = estimateBoq({ plot, floors, brief: project.brief, budget: { amount: project.budget, turnkey: project.turnkey }, site: project.site })
      const report = runDesignCheck({
        plot,
        floors,
        brief: project.brief,
        cost: { estimate: estimate.total, budget: project.budget, turnkey: estimate.includeInteriors },
        site: project.site,
      })
      setPreview({ key: floors, score: report.score, estimate })
    }, 30 + order * 20)
    return () => window.clearTimeout(timer)
  }, [floors, plot, project.brief, project.budget, project.turnkey, project.site, order])

  const current = preview && preview.key === floors ? preview : null
  const budget = current?.estimate.budget

  return (
    <Card
      role="link"
      tabIndex={0}
      aria-label={`Open ${project.name}`}
      className="cursor-pointer overflow-hidden transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen()
      }}
    >
      <div className="relative aspect-[4/3] border-b border-border bg-surface-2">
        {ground ? (
          <PlanThumbnail plot={plot} floor={ground} className="h-full w-full p-3" />
        ) : floors ? (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-text-faint">
            <LayoutDashboard className="size-6" />
            <span className="text-xs">No plan yet</span>
          </div>
        ) : (
          <div className="h-full w-full animate-pulse bg-surface-2" />
        )}
        {planned.length > 1 && (
          <span className="absolute top-2 left-2 rounded-sm bg-surface/90 px-1.5 py-0.5 text-[11px] font-medium text-text shadow-xs">
            {floorsLabel(planned.length)}
          </span>
        )}
        <div className="absolute top-2 right-2">
          <ProjectStatusBadge status={project.status} />
        </div>
      </div>
      <CardBody className="flex flex-col gap-1.5">
        <p className="truncate font-display font-semibold text-text">{project.name}</p>
        <p className="text-xs text-text-muted">
          {project.plotWidth}' × {project.plotHeight}' · {project.facing[0].toUpperCase() + project.facing.slice(1)}-facing · {formatCurrency(project.budget)}
        </p>
        <p className="truncate text-xs text-text-faint">{describeBrief(project.brief)}</p>
        <div className="mt-1 flex min-h-5 flex-wrap items-center gap-1.5">
          {current ? (
            <>
              <Badge variant={scoreVariant(current.score)} className="font-mono tabular-nums" title="Design check score">
                Score {current.score}
              </Badge>
              <Badge variant={budget ? BUDGET_VARIANT[budget.status] : 'neutral'} className="font-mono tabular-nums" title="Estimated cost">
                {formatLakhs(current.estimate.total)}
              </Badge>
            </>
          ) : ground || !floors ? (
            <span className="h-5 w-32 animate-pulse rounded-sm bg-surface-2" aria-hidden />
          ) : (
            <span className="text-xs text-text-faint">Generate a layout to see its score and cost</span>
          )}
        </div>
      </CardBody>
    </Card>
  )
}
