import { ClipboardList, Columns2, FileStack, Grid3x3, ListChecks, Minus, Plus, Ruler, Scaling, View } from 'lucide-react'
import { FloorSwitcher } from '@/components/canvas/FloorSwitcher'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Divider } from '@/components/ui/Divider'
import { IconButton } from '@/components/ui/IconButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Tooltip } from '@/components/ui/Tooltip'
import { scoreVariant, type DesignReport } from '@/lib/designCheck'
import { useActiveFloor, useDesignStore, type ViewMode } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: typeof View }[] = [
  { value: '2d', label: '2D Plan', icon: Scaling },
  { value: '3d', label: '3D View', icon: View },
  { value: 'split', label: 'Split', icon: Columns2 },
  { value: 'drawings', label: 'Drawings', icon: FileStack },
]

interface CanvasToolbarProps {
  /** The live design check; the toolbar shows its score and opens the full report. */
  designReport?: DesignReport
  onOpenDesignCheck?: () => void
}

export function CanvasToolbar({ designReport, onOpenDesignCheck }: CanvasToolbarProps) {
  const viewMode = useDesignStore((state) => state.viewMode)
  const setViewMode = useDesignStore((state) => state.setViewMode)
  const zoom = useDesignStore((state) => state.zoom)
  const zoomIn = useDesignStore((state) => state.zoomIn)
  const zoomOut = useDesignStore((state) => state.zoomOut)
  const resetZoom = useDesignStore((state) => state.resetZoom)
  const gridVisible = useDesignStore((state) => state.gridVisible)
  const toggleGrid = useDesignStore((state) => state.toggleGrid)
  const clearGuides = useDesignStore((state) => state.clearGuides)
  const projectId = useDesignStore((state) => state.projectId)
  const openBriefEditor = useProjectsStore((state) => state.openBriefEditor)
  const guides = useActiveFloor().guides
  const hasGuides = guides.vertical.length > 0 || guides.horizontal.length > 0
  // Grid, guides and zoom drive the 2D plan canvas only.
  const planVisible = viewMode === '2d' || viewMode === 'split'

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 overflow-x-auto border-b border-border bg-surface px-4 sm:px-6">
      <FloorSwitcher />

      <Divider orientation="vertical" className="h-6" />

      <SegmentedControl value={viewMode} onChange={setViewMode} options={VIEW_OPTIONS} />

      {designReport && onOpenDesignCheck && designReport.categories.length > 0 && (
        <Button variant="outline" size="sm" onClick={onOpenDesignCheck} className="shrink-0 gap-2">
          <ListChecks className="size-4" />
          <span className="hidden sm:inline">Design check</span>
          <Badge variant={scoreVariant(designReport.score)} className="font-mono tabular-nums">
            {designReport.score}
          </Badge>
        </Button>
      )}

      {projectId && (
        <Tooltip content="Plot, budget, rooms and style for this project">
          <IconButton label="Edit brief" size="sm" variant="ghost" onClick={() => openBriefEditor(projectId)}>
            <ClipboardList className="size-4" />
          </IconButton>
        </Tooltip>
      )}

      <div className="flex-1" />

      {planVisible && (
        <Tooltip content="Toggle grid">
          <IconButton
            label="Toggle grid"
            variant={gridVisible ? 'outline' : 'ghost'}
            size="sm"
            onClick={toggleGrid}
          >
            <Grid3x3 className="size-4" />
          </IconButton>
        </Tooltip>
      )}

      {planVisible && hasGuides && (
        <Tooltip content="Clear alignment guides">
          <IconButton label="Clear alignment guides" variant="ghost" size="sm" onClick={clearGuides}>
            <Ruler className="size-4" />
          </IconButton>
        </Tooltip>
      )}

      {planVisible && (
        <div className="flex items-center gap-0.5 rounded-md bg-surface-2 p-1">
          <IconButton label="Zoom out" size="sm" variant="ghost" onClick={zoomOut}>
            <Minus className="size-4" />
          </IconButton>
          <button
            type="button"
            onClick={resetZoom}
            className="min-w-11 rounded-sm px-1.5 py-1 text-center font-mono text-xs text-text-muted tabular-nums transition-colors hover:text-text"
          >
            {Math.round(zoom * 100)}%
          </button>
          <IconButton label="Zoom in" size="sm" variant="ghost" onClick={zoomIn}>
            <Plus className="size-4" />
          </IconButton>
        </div>
      )}
    </div>
  )
}
