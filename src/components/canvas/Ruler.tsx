import { type PointerEvent as ReactPointerEvent, useEffect, useRef } from 'react'
import type { ThemeColors } from '@/hooks/useThemeColors'
import type { LengthUnit } from '@/types/design'
import { toDisplayLength } from '@/lib/units'

export const RULER_SIZE = 22
const MIN_MAJOR_TICK_PX = 44
const MIN_MINOR_TICK_PX = 7
const STEP_CANDIDATES_FT = [1, 2, 5, 10, 20, 50]

function pickStep(scale: number) {
  for (const step of STEP_CANDIDATES_FT) {
    if (step * scale >= MIN_MAJOR_TICK_PX) return step
  }
  return STEP_CANDIDATES_FT[STEP_CANDIDATES_FT.length - 1]
}

interface RulerProps {
  orientation: 'horizontal' | 'vertical'
  lengthPx: number
  scale: number
  offsetPx: number
  plotLengthFt: number
  units: LengthUnit
  guidePositions: number[]
  colors: ThemeColors
  onGuideDragStart: (event: ReactPointerEvent<HTMLDivElement>) => void
}

export function Ruler({
  orientation,
  lengthPx,
  scale,
  offsetPx,
  plotLengthFt,
  units,
  guidePositions,
  colors,
  onGuideDragStart,
}: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const horizontal = orientation === 'horizontal'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || lengthPx <= 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const w = horizontal ? lengthPx : RULER_SIZE
    const h = horizontal ? RULER_SIZE : lengthPx
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = colors['--color-surface-2'] || '#f4f4f5'
    ctx.fillRect(0, 0, w, h)

    const step = pickStep(scale)
    const showMinor = scale >= MIN_MINOR_TICK_PX
    const tickStep = showMinor ? 1 : step

    ctx.strokeStyle = colors['--color-border-strong'] || '#a1a1aa'
    ctx.fillStyle = colors['--color-text-muted'] || '#71717a'
    ctx.font = '9px ui-sans-serif, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    const tickValues: number[] = []
    for (let v = 0; v <= plotLengthFt + 1e-6; v += tickStep) {
      tickValues.push(Math.round(v * 100) / 100)
    }

    for (const value of tickValues) {
      const pos = offsetPx + value * scale
      if (pos < -1 || pos > (horizontal ? w : h) + 1) continue
      const isMajor = Math.abs(value % step) < 1e-6
      const tickLen = isMajor ? RULER_SIZE * 0.6 : RULER_SIZE * 0.3

      ctx.beginPath()
      if (horizontal) {
        ctx.moveTo(pos, RULER_SIZE)
        ctx.lineTo(pos, RULER_SIZE - tickLen)
      } else {
        ctx.moveTo(RULER_SIZE, pos)
        ctx.lineTo(RULER_SIZE - tickLen, pos)
      }
      ctx.lineWidth = 1
      ctx.stroke()

      if (isMajor) {
        const label = `${Math.round(toDisplayLength(value, units) * 10) / 10}`
        if (horizontal) {
          ctx.fillText(label, pos + 3, 8)
        } else {
          ctx.save()
          ctx.translate(8, pos)
          ctx.rotate(-Math.PI / 2)
          ctx.fillText(label, 0, 0)
          ctx.restore()
        }
      }
    }

    ctx.strokeStyle = colors['--color-accent'] || '#f59e0b'
    ctx.lineWidth = 2
    for (const guide of guidePositions) {
      const pos = offsetPx + guide * scale
      if (pos < -2 || pos > (horizontal ? w : h) + 2) continue
      ctx.beginPath()
      if (horizontal) {
        ctx.moveTo(pos, RULER_SIZE - 6)
        ctx.lineTo(pos, RULER_SIZE)
      } else {
        ctx.moveTo(RULER_SIZE - 6, pos)
        ctx.lineTo(RULER_SIZE, pos)
      }
      ctx.stroke()
    }
  }, [orientation, horizontal, lengthPx, scale, offsetPx, plotLengthFt, units, guidePositions, colors])

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={`${orientation === 'horizontal' ? 'Horizontal' : 'Vertical'} ruler — drag to add an alignment guide`}
      title="Drag onto the plan to add an alignment guide"
      onPointerDown={onGuideDragStart}
      className="relative shrink-0 cursor-crosshair touch-none overflow-hidden bg-surface-2"
      style={horizontal ? { height: RULER_SIZE, width: lengthPx } : { width: RULER_SIZE, height: lengthPx }}
    >
      <canvas ref={canvasRef} />
    </div>
  )
}
