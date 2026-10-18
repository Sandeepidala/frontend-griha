import { ClipboardList, Columns2, FileStack, IndianRupee, ListChecks, MapPinned, Scaling, ShieldCheck, Sparkles, View } from 'lucide-react'
import { BuildSequenceButton } from '@/components/canvas/BuildSequenceButton'
import { ShareButton } from '@/components/share/SharePanel'
import { StyleButton } from '@/components/style/StylePicker'
import { ReviewStatusBadge } from '@/components/reviews/ReviewParts'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Divider } from '@/components/ui/Divider'
import { IconButton } from '@/components/ui/IconButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatLakhs, type BoqEstimate } from '@/lib/boq'
import { scoreVariant, type DesignReport } from '@/lib/designCheck'
import { useDesignStore, type ViewMode } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'
import type { Review } from '@/types/review'

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: typeof View }[] = [
  { value: '2d', label: 'Plan', icon: Scaling },
  { value: '3d', label: '3D', icon: View },
  { value: 'split', label: 'Split', icon: Columns2 },
  { value: 'drawings', label: 'Drawings', icon: FileStack },
  { value: 'site', label: 'Site', icon: MapPinned },
]

interface CanvasToolbarProps {
  /** The live design check; the toolbar shows its score and opens the full report. */
  designReport?: DesignReport
  onOpenDesignCheck?: () => void
  /** The live cost estimate; the toolbar shows its total, coloured by how it compares with the budget. */
  costEstimate?: BoqEstimate
  onOpenCostEstimate?: () => void
  /** Opens the layout generator. */
  onOpenGenerate?: () => void
  /** Opens the architect review panel; `review` is the latest one, whose status is shown. */
  onOpenReview?: () => void
  review?: Review | null
}

const BUDGET_VARIANT = { within: 'success', close: 'warning', over: 'danger' } as const

export function CanvasToolbar({
  designReport,
  onOpenDesignCheck,
  costEstimate,
  onOpenCostEstimate,
  onOpenGenerate,
  onOpenReview,
  review,
}: CanvasToolbarProps) {
  const viewMode = useDesignStore((state) => state.viewMode)
  const setViewMode = useDesignStore((state) => state.setViewMode)
  const projectId = useDesignStore((state) => state.projectId)
  const openBriefEditor = useProjectsStore((state) => state.openBriefEditor)

  // Project-wide actions only; the floor tabs and the plan's grid and zoom sit in the row below,
  // with the plot and room fields. Below 1700px the score and estimate chips drop their words (their
  // values stay), below 2xl Generate, Style and Share keep only their icons, and below xl so do the
  // other actions, so the row fits a laptop.
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-surface px-4 sm:px-6 2xl:gap-3">
      <SegmentedControl value={viewMode} onChange={setViewMode} options={VIEW_OPTIONS} />

      <Divider orientation="vertical" className="h-6" />

      {projectId && onOpenGenerate && (
        <Button variant="outline" size="sm" onClick={onOpenGenerate} className="shrink-0 gap-2" title="Generate layout options from the brief">
          <Sparkles className="size-4" />
          <span className="sr-only 2xl:not-sr-only">Generate</span>
        </Button>
      )}

      {projectId && <StyleButton />}

      {projectId && <BuildSequenceButton />}

      {designReport && onOpenDesignCheck && designReport.categories.length > 0 && (
        <Button variant="outline" size="sm" onClick={onOpenDesignCheck} className="shrink-0 gap-2" title="Design check">
          <ListChecks className="size-4" />
          <span className="sr-only min-[1700px]:not-sr-only">Design check</span>
          <Badge variant={scoreVariant(designReport.score)} className="font-mono tabular-nums">
            {designReport.score}
          </Badge>
        </Button>
      )}

      {costEstimate && onOpenCostEstimate && costEstimate.sections.length > 0 && (
        <Button variant="outline" size="sm" onClick={onOpenCostEstimate} className="shrink-0 gap-2" title="Cost estimate">
          <IndianRupee className="hidden size-4 min-[1700px]:block" />
          <span className="sr-only min-[1700px]:not-sr-only">Estimate</span>
          <Badge
            variant={costEstimate.budget ? BUDGET_VARIANT[costEstimate.budget.status] : 'neutral'}
            className="font-mono tabular-nums"
          >
            {formatLakhs(costEstimate.total)}
          </Badge>
        </Button>
      )}

      {projectId && <ShareButton />}

      {projectId && onOpenReview && (
        <Button variant="outline" size="sm" onClick={onOpenReview} className="shrink-0 gap-2" title="Architect review">
          <ShieldCheck className="size-4" />
          <span className="sr-only xl:not-sr-only">Review</span>
          {review && review.status !== 'cancelled' && <ReviewStatusBadge review={review} compact />}
        </Button>
      )}

      {projectId && (
        <Tooltip content="Plot, budget, rooms and style for this project">
          <IconButton label="Edit brief" size="sm" variant="ghost" onClick={() => openBriefEditor(projectId)}>
            <ClipboardList className="size-4" />
          </IconButton>
        </Tooltip>
      )}
    </div>
  )
}
