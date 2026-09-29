import { Copy, Plus, Trash2 } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/cn'
import { useDesignStore } from '@/stores/useDesignStore'

export function FloorSwitcher() {
  const floors = useDesignStore((state) => state.floors)
  const activeFloorId = useDesignStore((state) => state.activeFloorId)
  const setActiveFloorId = useDesignStore((state) => state.setActiveFloorId)
  const addFloor = useDesignStore((state) => state.addFloor)
  const removeFloor = useDesignStore((state) => state.removeFloor)
  const duplicateFloor = useDesignStore((state) => state.duplicateFloor)

  const sortedFloors = [...floors].sort((a, b) => b.level - a.level)

  return (
    <div className="flex items-center gap-1">
      <div role="radiogroup" aria-label="Floor" className="flex items-center gap-0.5 rounded-md bg-surface-2 p-1">
        {sortedFloors.map((floor) => {
          const active = floor.id === activeFloorId
          return (
            <button
              key={floor.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setActiveFloorId(floor.id)}
              className={cn(
                'rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                active ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text',
              )}
            >
              {floor.name}
            </button>
          )
        })}
      </div>

      <Popover
        align="start"
        panelClassName="w-48 p-1"
        trigger={
          <IconButton label="Floor options" size="sm" variant="ghost">
            <Plus className="size-4" />
          </IconButton>
        }
      >
        {(close) => (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => {
                addFloor()
                close()
              }}
              className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-text transition-colors hover:bg-surface-2"
            >
              <Plus className="size-4" /> Add floor above
            </button>
            <button
              type="button"
              onClick={() => {
                duplicateFloor(activeFloorId)
                close()
              }}
              className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-text transition-colors hover:bg-surface-2"
            >
              <Copy className="size-4" /> Duplicate current floor
            </button>
            {floors.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  removeFloor(activeFloorId)
                  close()
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
              >
                <Trash2 className="size-4" /> Delete current floor
              </button>
            )}
          </div>
        )}
      </Popover>
    </div>
  )
}
