import { Copy, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/cn'
import { useDesignStore } from '@/stores/useDesignStore'

/**
 * The floor tabs, with a menu to add, duplicate or delete floors. `vertical` stacks them like a
 * building, top floor first, for the floating control over the plan and 3D views.
 */
export function FloorSwitcher({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) {
  const floors = useDesignStore((state) => state.floors)
  const activeFloorId = useDesignStore((state) => state.activeFloorId)
  const setActiveFloorId = useDesignStore((state) => state.setActiveFloorId)
  const addFloor = useDesignStore((state) => state.addFloor)
  const removeFloor = useDesignStore((state) => state.removeFloor)
  const duplicateFloor = useDesignStore((state) => state.duplicateFloor)
  const resetOpeningEdits = useDesignStore((state) => state.resetOpeningEdits)
  const changedOpenings = Object.keys(floors.find((f) => f.id === activeFloorId)?.openingEdits ?? {}).length
  const vertical = orientation === 'vertical'

  const sortedFloors = [...floors].sort((a, b) => b.level - a.level)

  const menu = (
    <Popover
      align="start"
      side={vertical ? 'top' : 'bottom'}
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
          {changedOpenings > 0 && (
            <button
              type="button"
              onClick={() => {
                resetOpeningEdits()
                close()
              }}
              className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-text transition-colors hover:bg-surface-2"
            >
              <RotateCcw className="size-4" /> Reset doors and windows ({changedOpenings})
            </button>
          )}
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
  )

  return (
    <div className={cn('flex items-center gap-1', vertical && 'flex-col items-stretch rounded-lg border border-border bg-surface/95 p-1 shadow-md')}>
      {vertical && menu}
      <div
        role="radiogroup"
        aria-label="Floor"
        className={cn('flex gap-0.5 rounded-md bg-surface-2 p-1', vertical ? 'flex-col' : 'items-center')}
      >
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
                vertical && 'text-left',
                active ? 'bg-surface text-text shadow-xs' : 'text-text-muted hover:text-text',
              )}
            >
              {floor.name}
            </button>
          )
        })}
      </div>
      {!vertical && menu}
    </div>
  )
}
