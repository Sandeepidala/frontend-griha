import { useEffect, useState } from 'react'
import { Box, Check, Palette as PaletteIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SidePanel } from '@/components/ui/SidePanel'
import { estimateBoq, formatLakhs } from '@/lib/boq'
import { cn } from '@/lib/cn'
import { type Palette, STYLE_KITS, STYLE_ORDER, type StyleKit, lookFor } from '@/lib/style/kits'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { useStylePicker } from '@/stores/useStylePicker'
import type { DesignStyle } from '@/types/brief'
import { StyleThumbnail } from './StyleThumbnail'

/** The style's main colours, as dots: walls, trim, roof or base, and wood. */
function Swatch({ palette, kit, className }: { palette: Palette; kit: StyleKit; className?: string }) {
  const colors = [palette.wall, palette.trim, kit.roof === 'hip' || kit.tiledBands ? palette.roof : palette.base, palette.wood]
  return (
    <span className={cn('flex -space-x-1', className)} aria-hidden>
      {colors.map((color, i) => (
        <span key={i} className="size-4 rounded-full border border-black/10 ring-2 ring-surface" style={{ background: color }} />
      ))}
    </span>
  )
}

/** What each style would add to the estimate over the plain Modern house, worked out a style at a time. */
function useStyleCosts(open: boolean): Partial<Record<DesignStyle, number>> {
  const projectId = useDesignStore((state) => state.projectId)
  const plot = useDesignStore((state) => state.plot)
  const floors = useDesignStore((state) => state.floors)
  const project = useProjectsStore((state) => state.projects.find((p) => p.id === projectId))
  const [costs, setCosts] = useState<{ key: unknown[]; values: Partial<Record<DesignStyle, number>> }>({ key: [], values: {} })
  const key = [open, plot, floors, project?.brief, project?.budget, project?.turnkey, project?.site]
  const fresh = costs.key.length === key.length && costs.key.every((k, i) => k === key[i])

  useEffect(() => {
    if (!open || !project || fresh) return
    const values: Partial<Record<DesignStyle, number>> = {}
    let cancelled = false
    let i = 0
    // One style per tick, so opening the panel stays smooth.
    const next = () => {
      if (cancelled || i >= STYLE_ORDER.length) return
      const style = STYLE_ORDER[i++]
      values[style] = estimateBoq({ plot, floors, brief: { ...project.brief, style }, budget: { amount: project.budget, turnkey: project.turnkey }, site: project.site }).total
      if (i === STYLE_ORDER.length) setCosts({ key, values: { ...values } })
      else window.setTimeout(next, 0)
    }
    const timer = window.setTimeout(next, 120)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // `key` lists what the costs depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, key)

  return fresh ? costs.values : {}
}

function costLabel(costs: Partial<Record<DesignStyle, number>>, style: DesignStyle) {
  const base = costs.modern
  const value = costs[style]
  if (base === undefined || value === undefined) return null
  const extra = value - base
  return Math.abs(extra) < 5000 ? 'No extra cost' : `+${formatLakhs(extra)}`
}

/** The house style and colour scheme for the open project, with what each would look like and cost. */
export function StylePicker() {
  const open = useStylePicker((state) => state.open)
  const setOpen = useStylePicker((state) => state.setOpen)
  const projectId = useDesignStore((state) => state.projectId)
  const viewMode = useDesignStore((state) => state.viewMode)
  const setViewMode = useDesignStore((state) => state.setViewMode)
  const project = useProjectsStore((state) => state.projects.find((p) => p.id === projectId))
  const setProjectStyle = useProjectsStore((state) => state.setProjectStyle)
  const costs = useStyleCosts(open)
  if (!project) return null

  const { kit, palette } = lookFor(project.brief)
  const choose = (style: DesignStyle, scheme: string | null) => {
    if (style === kit.id && (scheme ?? STYLE_KITS[style].palettes[0].id) === palette.id) return
    void setProjectStyle(project.id, style, scheme)
  }
  const extra = costLabel(costs, kit.id)

  return (
    <SidePanel
      open={open}
      onClose={() => setOpen(false)}
      title="House style"
      description="The 3D model, drawings, build video and estimate all follow it. Your rooms stay as they are."
      defaultWidth={480}
    >
      <div className="flex flex-col gap-4 pb-4">
        {/* The choice so far, kept in view while the style cards scroll under it. */}
        <section className="sticky top-0 z-10 flex flex-col gap-2.5 border-b border-border bg-surface/95 px-5 pt-4 pb-3 backdrop-blur">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-text">{kit.name}</h3>
            {extra && <span className="text-xs font-medium text-text-muted">{extra === 'No extra cost' ? 'Standard cost' : `${extra} to the estimate`}</span>}
          </div>
          <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {kit.features.map((feature) => (
              <li key={feature} className="flex items-center gap-1 text-xs text-text-muted">
                <Check className="size-3.5 shrink-0 text-success" />
                {feature}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Colour scheme">
            <PaletteIcon className="size-4 text-text-faint" aria-hidden />
            {kit.palettes.map((p) => {
              const selected = p.id === palette.id
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => choose(kit.id, p.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-full border py-1 pr-3 pl-1.5 text-xs transition-colors',
                    selected ? 'border-primary bg-primary-soft/50 text-text' : 'border-border text-text-muted hover:border-border-strong hover:text-text',
                  )}
                >
                  <Swatch palette={p} kit={kit} className="[&>span]:size-3.5" />
                  {p.name}
                </button>
              )
            })}
          </div>
          {viewMode !== '3d' && viewMode !== 'split' && (
            <Button size="sm" variant="outline" className="self-start" onClick={() => setViewMode('3d')}>
              <Box className="size-4" /> See it in 3D
            </Button>
          )}
        </section>

        <section className="flex flex-col gap-2 px-5">
          <h3 className="text-xs font-semibold tracking-wide text-text-faint uppercase">Styles</h3>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="House style">
            {STYLE_ORDER.map((style) => {
              const option = STYLE_KITS[style]
              const selected = style === kit.id
              const cost = costLabel(costs, style)
              return (
                <button
                  key={style}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={option.name}
                  onClick={() => choose(style, null)}
                  className={cn(
                    'group flex flex-col overflow-hidden rounded-md border text-left transition-[border-color,box-shadow]',
                    selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-border-strong hover:shadow-sm',
                  )}
                >
                  <StyleThumbnail kit={option} palette={selected ? palette : option.palettes[0]} className="block aspect-[120/84] w-full" />
                  <span className="flex flex-col gap-0.5 px-2.5 py-2">
                    <span className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium text-text">{option.name}</span>
                      {selected && <Check className="size-4 text-primary" />}
                    </span>
                    <span className="line-clamp-2 text-[11px] leading-snug text-text-muted">{option.tagline}</span>
                    <span className={cn('mt-0.5 h-4 font-mono text-[11px] tabular-nums', cost ? 'text-text-muted' : 'animate-pulse text-transparent')}>
                      {cost ?? 'working out'}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-text-faint">Costs are what each style adds to this plan&apos;s estimate, compared with the plain Modern house.</p>
        </section>
      </div>
    </SidePanel>
  )
}

/** Opens the style picker; shows the current style and its colours. */
export function StyleButton({ compact = false }: { compact?: boolean }) {
  const setOpen = useStylePicker((state) => state.setOpen)
  const projectId = useDesignStore((state) => state.projectId)
  const brief = useProjectsStore((state) => state.projects.find((p) => p.id === projectId)?.brief)
  if (!brief) return null
  const { kit, palette } = lookFor(brief)
  return (
    <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="shrink-0 gap-2" title={`House style: ${kit.name}, ${palette.name}`}>
      <Swatch palette={palette} kit={kit} className="[&>span]:size-3" />
      <span className={compact ? '' : 'sr-only xl:not-sr-only'}>{compact ? `${kit.name} · ${palette.name}` : 'Style'}</span>
    </Button>
  )
}
