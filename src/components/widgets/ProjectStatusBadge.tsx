import { Badge, type BadgeProps } from '@/components/ui/Badge'
import type { ProjectStatus } from '@/types/project'

const STATUS_CONFIG: Record<ProjectStatus, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'Draft', variant: 'neutral' },
  generating: { label: 'Generating', variant: 'warning' },
  in_review: { label: 'In review', variant: 'primary' },
  ready: { label: 'Ready', variant: 'success' },
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge variant={config.variant} dot>
      {config.label}
    </Badge>
  )
}
