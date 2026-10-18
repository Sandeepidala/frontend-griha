import { useState } from 'react'
import { roomPalette } from '@/components/canvas/roomPalette'
import { PlanBase } from '@/components/drawings/symbols'
import { useThemeColors } from '@/hooks/useThemeColors'
import { type FloorModel, area } from '@/lib/drawings/geometry'
import { formatArea, formatLength } from '@/lib/units'
import { cn } from '@/lib/cn'
import type { LengthUnit } from '@/types/design'

/** Drawing scale: line weights and labels sized for a phone screen. */
const mm = (value: number) => value * 0.33

/** The plan floor by floor, as the drawings show it (walls, doors, windows, room names and sizes), with a room list. */
export function SharedPlan({ models, units }: { models: FloorModel[]; units: LengthUnit }) {
  const floors = models.filter((m) => m.rooms.length > 0 && m.footprint)
  const [active, setActive] = useState(0)
  const colors = useThemeColors()
  const model = floors[Math.min(active, floors.length - 1)]
  if (!model) return <p className="py-10 text-center text-sm text-text-muted">There's no plan to show yet.</p>

  const fp = model.footprint!
  const pad = 3
  const rooms = [...model.rooms].sort((a, b) => area(b) - area(a))
  const total = model.rooms.reduce((s, r) => s + area(r), 0)

  return (
    <div className="flex flex-col gap-4">
      {floors.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Floor">
          {floors.map((f, i) => (
            <button
              key={f.floor.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                i === active ? 'border-primary bg-primary text-on-primary' : 'border-border text-text-muted hover:text-text',
              )}
            >
              {f.floor.name}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-md border border-border bg-white">
        <svg
          viewBox={`${fp.x - pad} ${fp.y - pad} ${fp.width + pad * 2} ${fp.height + pad * 2 + 4}`}
          className="block h-auto w-full"
          role="img"
          aria-label={`${model.floor.name} plan`}
        >
          <PlanBase model={model} mm={mm} roomFill={(room) => roomPalette(room.type, colors).fill} />
          {/* North arrow: the plan is always drawn north-up. */}
          <g transform={`translate(${fp.x + fp.width - 1.5}, ${fp.y + fp.height + pad + 2})`}>
            <path d="M 0 -1.6 L 0.9 1 L 0 0.4 L -0.9 1 Z" fill="#1d1d1f" />
            <text x={1.5} y={0.9} fontSize={1.4} fontWeight={700} fill="#1d1d1f">
              N
            </text>
          </g>
        </svg>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-text">{model.floor.name}</span>
        <span className="text-text-muted">{formatArea(total, units)} of rooms</span>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {rooms.map((room) => (
          <li key={room.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-text">
              <span className="size-3 shrink-0 rounded-sm border border-black/10" style={{ background: roomPalette(room.type, colors).fill }} aria-hidden />
              {room.name}
            </span>
            <span className="font-mono text-xs text-text-muted tabular-nums">
              {formatLength(room.width, units)} × {formatLength(room.height, units)} · {formatArea(area(room), units)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
