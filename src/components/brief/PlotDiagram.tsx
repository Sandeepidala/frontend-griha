import { useThemeColors } from '@/hooks/useThemeColors'
import { requiredSetbacks } from '@/lib/drawings/geometry'
import type { Plot } from '@/types/design'

const fmt = (ft: number) => `${Math.round(ft * 10) / 10}′`

/**
 * The plot to scale, north up: the road on its facing side, the setbacks the rules require, and the
 * area left to build on. `plot.setbacks` should already be the required ones.
 */
export function PlotDiagram({ plot, roadWidthFt, className }: { plot: Plot; roadWidthFt: number | null; className?: string }) {
  const colors = useThemeColors()
  const { width: w, height: h, facing } = plot
  const s = requiredSetbacks(plot)
  const size = Math.max(w, h)
  const margin = size * 0.32
  const font = size * 0.068
  const band = size * 0.14
  const inner = { x: s.W, y: s.N, width: Math.max(0, w - s.W - s.E), height: Math.max(0, h - s.N - s.S) }

  const road = {
    north: { x: -margin * 0.4, y: -band - size * 0.03, width: w + margin * 0.8, height: band },
    south: { x: -margin * 0.4, y: h + size * 0.03, width: w + margin * 0.8, height: band },
    east: { x: w + size * 0.03, y: -margin * 0.4, width: band, height: h + margin * 0.8 },
    west: { x: -band - size * 0.03, y: -margin * 0.4, width: band, height: h + margin * 0.8 },
  }[facing]
  const roadLabel = `Road${roadWidthFt ? ` · ${roadWidthFt} ft wide` : ''}`
  const vertical = facing === 'east' || facing === 'west'
  const roadCx = road.x + road.width / 2
  const roadCy = road.y + road.height / 2

  // Dimensions go on the sides away from the road.
  const widthY = facing === 'south' ? -size * 0.08 : h + size * 0.1
  const lengthX = facing === 'west' ? w + size * 0.08 : -size * 0.08

  const strips = [
    { side: 'N', value: s.N, x: w / 2, y: s.N / 2 },
    { side: 'S', value: s.S, x: w / 2, y: h - s.S / 2 },
    { side: 'W', value: s.W, x: s.W / 2, y: h / 2 },
    { side: 'E', value: s.E, x: w - s.E / 2, y: h / 2 },
  ].filter((strip) => strip.value >= font * 1.1)

  // Top right, clear of a road band on the north or east side.
  const arrow = { x: w + margin * 0.7, y: -margin * 0.7, r: font }

  return (
    <svg
      viewBox={`${-margin} ${-margin} ${w + margin * 2} ${h + margin * 2}`}
      className={className}
      role="img"
      aria-label={`Plot ${w} by ${h} feet, ${facing}-facing; ${Math.round(inner.width * inner.height).toLocaleString('en-IN')} sq ft inside the setbacks`}
    >
      <rect {...road} rx={font * 0.4} fill={colors['--color-surface-2']} stroke={colors['--color-border-strong']} strokeWidth={size * 0.003} />
      <text
        x={roadCx}
        y={roadCy}
        fontSize={font}
        fill={colors['--color-text-muted']}
        textAnchor="middle"
        dominantBaseline="central"
        transform={vertical ? `rotate(-90 ${roadCx} ${roadCy})` : undefined}
      >
        {roadLabel}
      </text>

      <rect x={0} y={0} width={w} height={h} fill={colors['--color-surface']} stroke={colors['--color-text']} strokeWidth={size * 0.006} />
      <rect
        {...inner}
        fill={colors['--color-primary-soft']}
        stroke={colors['--color-primary']}
        strokeWidth={size * 0.004}
        strokeDasharray={`${size * 0.015} ${size * 0.01}`}
      />
      {inner.width > font * 7 && inner.height > font * 3 && (
        <text x={inner.x + inner.width / 2} y={inner.y + inner.height / 2} fontSize={font} fill={colors['--color-primary']} textAnchor="middle" fontWeight={600}>
          <tspan x={inner.x + inner.width / 2} dy={-font * 0.2}>
            Buildable
          </tspan>
          <tspan x={inner.x + inner.width / 2} dy={font * 1.2}>{`${Math.round(inner.width)}′ × ${Math.round(inner.height)}′`}</tspan>
        </text>
      )}
      {strips.map((strip) => (
        <text key={strip.side} x={strip.x} y={strip.y} fontSize={font * 0.8} fill={colors['--color-text-muted']} textAnchor="middle" dominantBaseline="central">
          {fmt(strip.value)}
        </text>
      ))}

      <text x={w / 2} y={widthY} fontSize={font} fill={colors['--color-text']} textAnchor="middle" dominantBaseline="central" fontWeight={600}>
        {fmt(w)}
      </text>
      <text
        x={lengthX}
        y={h / 2}
        fontSize={font}
        fill={colors['--color-text']}
        textAnchor="middle"
        dominantBaseline="central"
        fontWeight={600}
        transform={`rotate(-90 ${lengthX} ${h / 2})`}
      >
        {fmt(h)}
      </text>

      <g aria-hidden>
        <circle cx={arrow.x} cy={arrow.y} r={arrow.r} fill="none" stroke={colors['--color-border-strong']} strokeWidth={size * 0.003} />
        <path
          d={`M ${arrow.x} ${arrow.y - arrow.r * 0.75} L ${arrow.x + arrow.r * 0.35} ${arrow.y + arrow.r * 0.4} L ${arrow.x} ${arrow.y + arrow.r * 0.15} L ${arrow.x - arrow.r * 0.35} ${arrow.y + arrow.r * 0.4} Z`}
          fill={colors['--color-text']}
        />
        <text x={arrow.x - arrow.r * 1.7} y={arrow.y} fontSize={font * 0.85} fill={colors['--color-text']} textAnchor="middle" dominantBaseline="central" fontWeight={600}>
          N
        </text>
      </g>
    </svg>
  )
}
