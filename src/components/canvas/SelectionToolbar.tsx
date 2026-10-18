import { type ChangeEvent, type ReactNode, useMemo } from 'react'
import { Eye, EyeOff, FlipHorizontal2, FlipVertical2, Lock, Plus, RotateCcw, StickyNote, Trash2, Unlock, X } from 'lucide-react'
import { roomPalette } from '@/components/canvas/roomPalette'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { Popover } from '@/components/ui/Popover'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Divider } from '@/components/ui/Divider'
import { Tooltip } from '@/components/ui/Tooltip'
import { useThemeColors } from '@/hooks/useThemeColors'
import { cn } from '@/lib/cn'
import { type PlanOpeningKind, type Side, buildFloorModel, isDoor, wallLength } from '@/lib/drawings/geometry'
import { formatLength, fromDisplayLength, toDisplayLength, unitSuffix } from '@/lib/units'
import { useActiveFloor, useDesignStore, useSelectedRoom } from '@/stores/useDesignStore'
import type { FloorFinish, LengthUnit, OpeningEdit, Room, RoomType, Setbacks } from '@/types/design'

const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  living: 'Living',
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  wet: 'Wet Area',
  pooja: 'Pooja Room',
  utility: 'Utility',
  circulation: 'Circulation',
}

const FLOOR_FINISH_LABELS: Record<FloorFinish, string> = {
  tile: 'Tile',
  marble: 'Marble',
  wood: 'Wood',
  carpet: 'Carpet',
  concrete: 'Concrete',
}

const FACING_LABELS: Record<'north' | 'south' | 'east' | 'west', string> = {
  north: 'North',
  south: 'South',
  east: 'East',
  west: 'West',
}

const UNIT_OPTIONS: { value: LengthUnit; label: string }[] = [
  { value: 'ft', label: 'ft' },
  { value: 'm', label: 'm' },
]

function ToolbarField({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-[10px] font-semibold tracking-wide text-text-faint uppercase">{label}</span>
      {children}
    </label>
  )
}

function LengthField({
  label,
  valueFt,
  units,
  step,
  onCommitFt,
}: {
  label: string
  valueFt: number
  units: LengthUnit
  step?: number
  onCommitFt: (feet: number) => void
}) {
  const display = Math.round(toDisplayLength(valueFt, units) * 100) / 100
  return (
    <ToolbarField label={`${label} (${unitSuffix(units)})`}>
      <Input
        type="number"
        inputSize="sm"
        className="w-16"
        step={step ?? (units === 'm' ? 0.1 : 0.5)}
        value={display}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const next = event.target.valueAsNumber
          if (Number.isFinite(next)) onCommitFt(fromDisplayLength(next, units))
        }}
      />
    </ToolbarField>
  )
}

function RoomToolbar({ room }: { room: Room }) {
  const colors = useThemeColors()
  const units = useDesignStore((state) => state.plot.units)
  const updateRoom = useDesignStore((state) => state.updateRoom)
  const removeRoom = useDesignStore((state) => state.removeRoom)

  const defaultColor = roomPalette(room.type, colors).fill
  const hasNote = room.notes.trim().length > 0 || !!room.label

  return (
    <>
      <ToolbarField label="Name">
        <Input
          inputSize="sm"
          className="w-36"
          value={room.name}
          onChange={(event) => updateRoom(room.id, { name: event.target.value })}
        />
      </ToolbarField>

      <ToolbarField label="Type">
        <Select
          selectSize="sm"
          className="w-32"
          value={room.type}
          onChange={(event) => updateRoom(room.id, { type: event.target.value as RoomType })}
        >
          {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </ToolbarField>

      <Divider orientation="vertical" />

      <LengthField label="X" valueFt={room.x} units={units} onCommitFt={(v) => updateRoom(room.id, { x: v })} />
      <LengthField label="Y" valueFt={room.y} units={units} onCommitFt={(v) => updateRoom(room.id, { y: v })} />
      <LengthField
        label="W"
        valueFt={room.width}
        units={units}
        onCommitFt={(v) => updateRoom(room.id, { width: v })}
      />
      <LengthField
        label="H"
        valueFt={room.height}
        units={units}
        onCommitFt={(v) => updateRoom(room.id, { height: v })}
      />

      <ToolbarField label="Rotation (°)">
        <Input
          type="number"
          inputSize="sm"
          className="w-16"
          step={15}
          value={room.rotation}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const next = event.target.valueAsNumber
            if (Number.isFinite(next)) updateRoom(room.id, { rotation: next })
          }}
        />
      </ToolbarField>

      <Divider orientation="vertical" />

      <LengthField
        label="Wall height"
        valueFt={room.wallHeight}
        units={units}
        onCommitFt={(v) => updateRoom(room.id, { wallHeight: Math.max(1, v) })}
      />
      <LengthField
        label="Elevation"
        valueFt={room.elevation}
        units={units}
        onCommitFt={(v) => updateRoom(room.id, { elevation: v })}
      />

      <Divider orientation="vertical" />

      <ToolbarField label="Color">
        <div className="flex items-center gap-1">
          <input
            type="color"
            aria-label="Room color"
            className="size-8 cursor-pointer rounded-md border border-border-strong bg-transparent p-0.5"
            value={room.color ?? defaultColor}
            onChange={(event) => updateRoom(room.id, { color: event.target.value })}
          />
          {room.color && (
            <IconButton
              label="Reset to default color"
              size="sm"
              variant="ghost"
              onClick={() => updateRoom(room.id, { color: null })}
            >
              <X className="size-3.5" />
            </IconButton>
          )}
        </div>
      </ToolbarField>

      <ToolbarField label="Floor finish">
        <Select
          selectSize="sm"
          className="w-28"
          value={room.floorFinish}
          onChange={(event) => updateRoom(room.id, { floorFinish: event.target.value as FloorFinish })}
        >
          {Object.entries(FLOOR_FINISH_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </ToolbarField>

      <Divider orientation="vertical" />

      <ToolbarField label="Flags">
        <div className="flex items-center gap-1">
          <Tooltip content={room.locked ? 'Unlock room' : 'Lock room'}>
            <IconButton
              label={room.locked ? 'Unlock room' : 'Lock room'}
              size="sm"
              variant={room.locked ? 'outline' : 'ghost'}
              onClick={() => updateRoom(room.id, { locked: !room.locked })}
            >
              {room.locked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
            </IconButton>
          </Tooltip>
          <Tooltip content={room.visible ? 'Hide room' : 'Show room'}>
            <IconButton
              label={room.visible ? 'Hide room' : 'Show room'}
              size="sm"
              variant={room.visible ? 'ghost' : 'outline'}
              onClick={() => updateRoom(room.id, { visible: !room.visible })}
            >
              {room.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </IconButton>
          </Tooltip>
          <Popover
            trigger={
              <span className="relative inline-flex">
                <IconButton label="Label & notes" size="sm" variant={hasNote ? 'outline' : 'ghost'}>
                  <StickyNote className="size-4" />
                </IconButton>
                {hasNote && (
                  <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-accent" aria-hidden="true" />
                )}
              </span>
            }
            panelClassName="w-64 p-3"
          >
            <div className="flex flex-col gap-3">
              <ToolbarField label="Label override">
                <Input
                  inputSize="sm"
                  placeholder={room.name}
                  value={room.label ?? ''}
                  onChange={(event) => updateRoom(room.id, { label: event.target.value || null })}
                />
              </ToolbarField>
              <ToolbarField label="Notes">
                <Textarea
                  rows={3}
                  className="text-sm"
                  value={room.notes}
                  onChange={(event) => updateRoom(room.id, { notes: event.target.value })}
                />
              </ToolbarField>
            </div>
          </Popover>
          <Tooltip content="Delete room">
            <IconButton label="Delete room" size="sm" variant="ghost" onClick={() => removeRoom(room.id)}>
              <Trash2 className="size-4 text-danger" />
            </IconButton>
          </Tooltip>
        </div>
      </ToolbarField>
    </>
  )
}

const SIDE_NAMES: Record<Side, string> = { N: 'north', S: 'south', E: 'east', W: 'west' }
const OPENING_LABELS: Record<PlanOpeningKind, string> = { door: 'Door', 'main-door': 'Main door', window: 'Window', ventilator: 'Ventilator' }
const OPENING_WIDTHS: Record<PlanOpeningKind, number[]> = {
  door: [2.5, 3, 3.5, 4],
  'main-door': [3, 3.5, 4, 5],
  window: [2, 3, 4, 5, 6],
  ventilator: [1.5, 2, 2.5],
}

/** A group of buttons under a caption (a div: a <label> would pass clicks on its caption to the first button). */
function ToolbarGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold tracking-wide text-text-faint uppercase">{label}</span>
      <div className="flex min-h-8 items-center gap-1">{children}</div>
    </div>
  )
}

/** The selected door or window: its size and place on the wall, its swing, and removing or resetting it. */
function OpeningToolbar({ openingKey }: { openingKey: string }) {
  const plot = useDesignStore((state) => state.plot)
  const floors = useDesignStore((state) => state.floors)
  const floor = useActiveFloor()
  const setOpeningEdit = useDesignStore((state) => state.setOpeningEdit)
  const model = useMemo(() => buildFloorModel(floor, floors, plot), [floor, floors, plot])
  const opening = model.openings.find((o) => o.key === openingKey)
  if (!opening) return <p className="self-center text-sm text-text-muted">That door or window is no longer on this floor.</p>

  const edit = floor.openingEdits?.[openingKey] ?? {}
  const change = (patch: OpeningEdit) => setOpeningEdit(openingKey, { ...edit, ...patch })
  const roomName = (id: string) => model.rooms.find((r) => r.id === id)?.name ?? 'a room'
  const side = opening.wall.outside ? SIDE_NAMES[opening.wall.outside] : null
  const door = isDoor(opening)
  const description =
    opening.kind === 'door'
      ? `Between ${roomName(opening.roomIds[0])} and ${roomName(opening.roomIds[1])}`
      : `${roomName(opening.roomIds[0])}${side ? `, ${side} wall` : ''}`
  const length = wallLength(opening.wall)
  const at = length > 0 ? (opening.center - opening.wall.from) / length : 0.5
  const widths = [...new Set([...OPENING_WIDTHS[opening.kind], opening.width])].sort((a, b) => a - b)
  const noun = door ? 'door' : 'window'

  return (
    <>
      <ToolbarGroup label={OPENING_LABELS[opening.kind]}>
        <span className="text-sm font-medium text-text">{description}</span>
      </ToolbarGroup>

      <Divider orientation="vertical" />

      <ToolbarField label="Width">
        <Select selectSize="sm" className="w-24" value={String(opening.width)} onChange={(event) => change({ width: Number(event.target.value) })}>
          {widths.map((value) => (
            <option key={value} value={value}>
              {formatLength(value, plot.units)}
            </option>
          ))}
        </Select>
      </ToolbarField>

      <ToolbarField label="Along the wall">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={at}
          onChange={(event) => change({ at: Number(event.target.value) })}
          className="h-8 w-40 accent-primary"
          aria-label="Position along the wall (or drag it on the plan)"
        />
      </ToolbarField>

      {door && (
        <ToolbarGroup label="Swing">
          <Tooltip content="Open to the other side of the wall">
            <IconButton label="Flip the swing" size="sm" variant="outline" onClick={() => change({ flipSwing: !edit.flipSwing })}>
              <FlipVertical2 className="size-4" />
            </IconButton>
          </Tooltip>
          <Tooltip content="Hinge at the other end">
            <IconButton label="Flip the hinge" size="sm" variant="outline" onClick={() => change({ flipHinge: !edit.flipHinge })}>
              <FlipHorizontal2 className="size-4" />
            </IconButton>
          </Tooltip>
        </ToolbarGroup>
      )}

      <Divider orientation="vertical" />

      <ToolbarGroup label="Change">
        {Object.keys(edit).length > 0 && (
          <Tooltip content="Back to where Griha placed it">
            <IconButton label={`Reset this ${noun}`} size="sm" variant="ghost" onClick={() => setOpeningEdit(openingKey, null)}>
              <RotateCcw className="size-4" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip content={`Remove this ${noun}`}>
          <IconButton label={`Remove this ${noun}`} size="sm" variant="ghost" onClick={() => change({ removed: true })}>
            <Trash2 className="size-4 text-danger" />
          </IconButton>
        </Tooltip>
      </ToolbarGroup>
    </>
  )
}

function PlotToolbar() {
  const plot = useDesignStore((state) => state.plot)
  const updatePlot = useDesignStore((state) => state.updatePlot)
  const addRoom = useDesignStore((state) => state.addRoom)

  function updateSetback(key: keyof Setbacks, feet: number) {
    updatePlot({ setbacks: { ...plot.setbacks, [key]: Math.max(0, feet) } })
  }

  return (
    <>
      <LengthField
        label="Plot width"
        valueFt={plot.width}
        units={plot.units}
        onCommitFt={(v) => updatePlot({ width: Math.max(5, v) })}
      />
      <LengthField
        label="Plot depth"
        valueFt={plot.height}
        units={plot.units}
        onCommitFt={(v) => updatePlot({ height: Math.max(5, v) })}
      />

      <Divider orientation="vertical" />

      <ToolbarField label="Facing">
        <Select
          selectSize="sm"
          className="w-28"
          value={plot.facing}
          onChange={(event) =>
            updatePlot({ facing: event.target.value as 'north' | 'south' | 'east' | 'west' })
          }
        >
          {Object.entries(FACING_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </ToolbarField>

      <ToolbarField label="Units">
        <SegmentedControl value={plot.units} onChange={(units) => updatePlot({ units })} options={UNIT_OPTIONS} />
      </ToolbarField>

      <Divider orientation="vertical" />

      <ToolbarField label="Setbacks">
        <Popover trigger={<Input inputSize="sm" className="w-28 cursor-pointer" readOnly value="Edit setbacks" />} panelClassName="w-56 p-3">
          <div className="grid grid-cols-2 gap-3">
            <LengthField
              label="Front"
              valueFt={plot.setbacks.front}
              units={plot.units}
              onCommitFt={(v) => updateSetback('front', v)}
            />
            <LengthField
              label="Rear"
              valueFt={plot.setbacks.rear}
              units={plot.units}
              onCommitFt={(v) => updateSetback('rear', v)}
            />
            <LengthField
              label="Left"
              valueFt={plot.setbacks.left}
              units={plot.units}
              onCommitFt={(v) => updateSetback('left', v)}
            />
            <LengthField
              label="Right"
              valueFt={plot.setbacks.right}
              units={plot.units}
              onCommitFt={(v) => updateSetback('right', v)}
            />
          </div>
        </Popover>
      </ToolbarField>

      <Divider orientation="vertical" />

      <Tooltip content="Add a room to this floor">
        <IconButton label="Add room" size="sm" variant="outline" onClick={addRoom}>
          <Plus className="size-4" />
        </IconButton>
      </Tooltip>
    </>
  )
}

export function SelectionToolbar() {
  const selectedRoom = useSelectedRoom()
  const selection = useDesignStore((state) => state.selection)

  return (
    <div className="flex min-h-14 shrink-0 flex-wrap items-end gap-x-4 gap-y-2 border-b border-border bg-surface-2/60 px-4 py-2 sm:px-6">
      {selectedRoom ? (
        <RoomToolbar room={selectedRoom} />
      ) : selection?.type === 'opening' ? (
        <OpeningToolbar openingKey={selection.id} />
      ) : (
        <PlotToolbar />
      )}
    </div>
  )
}
