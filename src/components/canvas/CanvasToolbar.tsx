import { Columns2, Grid3x3, Minus, Plus, Scaling, View } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/IconButton'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Tooltip } from '@/components/ui/Tooltip'
import { useDesignStore, useSelectedRoom, type ViewMode } from '@/stores/useDesignStore'

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: typeof View }[] = [
  { value: '2d', label: '2D Plan', icon: Scaling },
  { value: '3d', label: '3D View', icon: View },
  { value: 'split', label: 'Split', icon: Columns2 },
]

export function CanvasToolbar() {
  const viewMode = useDesignStore((state) => state.viewMode)
  const setViewMode = useDesignStore((state) => state.setViewMode)
  const zoom = useDesignStore((state) => state.zoom)
  const zoomIn = useDesignStore((state) => state.zoomIn)
  const zoomOut = useDesignStore((state) => state.zoomOut)
  const resetZoom = useDesignStore((state) => state.resetZoom)
  const gridVisible = useDesignStore((state) => state.gridVisible)
  const toggleGrid = useDesignStore((state) => state.toggleGrid)
  const selectedRoom = useSelectedRoom()

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <SegmentedControl value={viewMode} onChange={setViewMode} options={VIEW_OPTIONS} />

      {selectedRoom && (
        <Badge variant="primary" className="hidden sm:inline-flex">
          {selectedRoom.name} · {selectedRoom.width}' × {selectedRoom.height}'
        </Badge>
      )}

      <div className="flex-1" />

      {viewMode !== '3d' && (
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

      {viewMode !== '3d' && (
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
