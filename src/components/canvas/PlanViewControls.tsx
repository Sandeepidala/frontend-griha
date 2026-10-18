import { BrickWall, Grid3x3, Minus, Plus, Ruler } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { Tooltip } from '@/components/ui/Tooltip'
import { useActiveFloor, useDesignStore } from '@/stores/useDesignStore'

/** The 2D plan's view controls (grid, alignment guides, zoom), floating at the plan's bottom right. */
export function PlanViewControls() {
  const zoom = useDesignStore((state) => state.zoom)
  const zoomIn = useDesignStore((state) => state.zoomIn)
  const zoomOut = useDesignStore((state) => state.zoomOut)
  const resetZoom = useDesignStore((state) => state.resetZoom)
  const gridVisible = useDesignStore((state) => state.gridVisible)
  const toggleGrid = useDesignStore((state) => state.toggleGrid)
  const wallsVisible = useDesignStore((state) => state.wallsVisible)
  const toggleWalls = useDesignStore((state) => state.toggleWalls)
  const clearGuides = useDesignStore((state) => state.clearGuides)
  const guides = useActiveFloor().guides
  const hasGuides = guides.vertical.length > 0 || guides.horizontal.length > 0

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface/95 p-1 shadow-md">
      <Tooltip content={wallsVisible ? 'Hide walls, doors and windows' : 'Show walls, doors and windows'}>
        <IconButton label="Show walls, doors and windows" variant={wallsVisible ? 'outline' : 'ghost'} size="sm" onClick={toggleWalls} aria-pressed={wallsVisible}>
          <BrickWall className="size-4" />
        </IconButton>
      </Tooltip>

      <Tooltip content="Toggle grid">
        <IconButton label="Toggle grid" variant={gridVisible ? 'outline' : 'ghost'} size="sm" onClick={toggleGrid}>
          <Grid3x3 className="size-4" />
        </IconButton>
      </Tooltip>

      {hasGuides && (
        <Tooltip content="Clear alignment guides">
          <IconButton label="Clear alignment guides" variant="ghost" size="sm" onClick={clearGuides}>
            <Ruler className="size-4" />
          </IconButton>
        </Tooltip>
      )}

      <div className="flex items-center gap-0.5 rounded-md bg-surface-2 p-0.5">
        <IconButton label="Zoom out" size="sm" variant="ghost" onClick={zoomOut}>
          <Minus className="size-4" />
        </IconButton>
        <button
          type="button"
          onClick={resetZoom}
          title="Reset zoom"
          className="min-w-11 rounded-sm px-1.5 py-1 text-center font-mono text-xs text-text-muted tabular-nums transition-colors hover:text-text"
        >
          {Math.round(zoom * 100)}%
        </button>
        <IconButton label="Zoom in" size="sm" variant="ghost" onClick={zoomIn}>
          <Plus className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}
