import { roomPalette } from '@/components/canvas/roomPalette'
import { useThemeColors } from '@/hooks/useThemeColors'
import { requiredSetbacks } from '@/lib/drawings/geometry'
import type { Floor, Plot } from '@/types/design'

/** A small north-up drawing of one floor: the plot, its setback line, the road side and the rooms. */
export function PlanThumbnail({ plot, floor, className }: { plot: Plot; floor: Floor; className?: string }) {
  const colors = useThemeColors()
  const s = requiredSetbacks(plot)
  const pad = 2
  const road = {
    north: { x1: 0, y1: -1, x2: plot.width, y2: -1 },
    south: { x1: 0, y1: plot.height + 1, x2: plot.width, y2: plot.height + 1 },
    east: { x1: plot.width + 1, y1: 0, x2: plot.width + 1, y2: plot.height },
    west: { x1: -1, y1: 0, x2: -1, y2: plot.height },
  }[plot.facing]

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${plot.width + pad * 2} ${plot.height + pad * 2}`}
      className={className}
      role="img"
      aria-label={`${floor.name}: ${floor.rooms.length} rooms`}
    >
      <rect x={0} y={0} width={plot.width} height={plot.height} fill="none" stroke={colors['--color-border-strong']} strokeWidth={0.3} />
      <rect
        x={s.W}
        y={s.N}
        width={plot.width - s.W - s.E}
        height={plot.height - s.N - s.S}
        fill="none"
        stroke={colors['--color-border']}
        strokeWidth={0.25}
        strokeDasharray="1 1"
      />
      <line {...road} stroke={colors['--color-primary']} strokeWidth={1.2} strokeLinecap="round">
        <title>{`Road (${plot.facing})`}</title>
      </line>
      {floor.rooms.map((room) => {
        const { fill, stroke } = roomPalette(room.type, colors)
        return (
          <rect key={room.id} x={room.x} y={room.y} width={room.width} height={room.height} fill={fill} stroke={stroke} strokeWidth={0.3}>
            <title>{`${room.name} · ${room.width} × ${room.height} ft`}</title>
          </rect>
        )
      })}
    </svg>
  )
}
