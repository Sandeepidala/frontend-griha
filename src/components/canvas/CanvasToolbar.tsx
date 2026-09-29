import { Columns2, Grid3x3, Minus, Plus, Scaling, Trash2, View } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { IconButton } from '@/components/ui/IconButton'
import { Popover } from '@/components/ui/Popover'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Tooltip } from '@/components/ui/Tooltip'
import { useDesignStore, useSelectedRoom, type ViewMode } from '@/stores/useDesignStore'
import { ROOM_TYPE_LABELS, type RoomType } from '@/types/design'

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: typeof View }[] = [
  { value: '2d', label: '2D Plan', icon: Scaling },
  { value: '3d', label: '3D View', icon: View },
  { value: 'split', label: 'Split', icon: Columns2 },
]

const ROOM_TYPES = Object.keys(ROOM_TYPE_LABELS) as RoomType[]

export function CanvasToolbar() {
  const viewMode = useDesignStore((state) => state.viewMode)
  const setViewMode = useDesignStore((state) => state.setViewMode)
  const zoom = useDesignStore((state) => state.zoom)
  const zoomIn = useDesignStore((state) => state.zoomIn)
  const zoomOut = useDesignStore((state) => state.zoomOut)
  const resetZoom = useDesignStore((state) => state.resetZoom)
  const gridVisible = useDesignStore((state) => state.gridVisible)
  const toggleGrid = useDesignStore((state) => state.toggleGrid)
  const addRoom = useDesignStore((state) => state.addRoom)
  const removeRoom = useDesignStore((state) => state.removeRoom)
  const selectedRoom = useSelectedRoom()

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <SegmentedControl value={viewMode} onChange={setViewMode} options={VIEW_OPTIONS} />

      <Popover
        align="start"
        panelClassName="w-48 p-1"
        trigger={
          <IconButton label="Add room" size="sm" variant="outline">
            <Plus className="size-4" />
          </IconButton>
        }
      >
        {(close) => (
          <div className="flex flex-col">
            {ROOM_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  addRoom(type)
                  close()
                }}
                className="rounded-md px-3 py-2 text-left text-sm text-text transition-colors hover:bg-surface-2"
              >
                {ROOM_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        )}
      </Popover>

      {selectedRoom && (
        <>
          <Badge variant="primary" className="hidden sm:inline-flex">
            {selectedRoom.name} · {selectedRoom.width}' × {selectedRoom.height}'
          </Badge>
          <Tooltip content="Delete room">
            <IconButton label="Delete room" size="sm" variant="ghost" onClick={() => removeRoom(selectedRoom.id)}>
              <Trash2 className="size-4" />
            </IconButton>
          </Tooltip>
        </>
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
