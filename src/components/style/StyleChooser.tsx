import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { STYLE_KITS, STYLE_ORDER, lookFor } from '@/lib/style/kits'
import type { DesignStyle, ProjectBrief } from '@/types/brief'
import { StyleThumbnail } from './StyleThumbnail'

interface StyleChooserProps {
  brief: Pick<ProjectBrief, 'style' | 'palette'>
  onChange: (patch: { style: DesignStyle; palette: string | null }) => void
}

/** Picks a house style by its picture, then one of its colour schemes; for the brief, before there's a plan. */
export function StyleChooser({ brief, onChange }: StyleChooserProps) {
  const { kit, palette } = lookFor(brief)
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="House style">
        {STYLE_ORDER.map((style) => {
          const option = STYLE_KITS[style]
          const selected = style === kit.id
          return (
            <button
              key={style}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.name}
              title={option.tagline}
              onClick={() => onChange({ style, palette: null })}
              className={cn(
                'relative flex flex-col overflow-hidden rounded-md border text-left transition-[border-color,box-shadow]',
                selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-border-strong',
              )}
            >
              <StyleThumbnail kit={option} palette={selected ? palette : option.palettes[0]} className="block aspect-[120/84] w-full" />
              <span className="flex items-center justify-between gap-1 px-2 py-1.5 text-xs font-medium text-text">
                {option.name}
                {selected && <Check className="size-3.5 text-primary" />}
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-text-muted">{kit.tagline}.</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Colour scheme">
        {kit.palettes.map((p) => {
          const selected = p.id === palette.id
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange({ style: kit.id, palette: p.id })}
              className={cn(
                'flex items-center gap-2 rounded-full border py-1 pr-3 pl-1.5 text-xs transition-colors',
                selected ? 'border-primary bg-primary-soft/50 text-text' : 'border-border text-text-muted hover:border-border-strong hover:text-text',
              )}
            >
              <span className="flex -space-x-1" aria-hidden>
                {[p.wall, p.trim, kit.roof === 'hip' || kit.tiledBands ? p.roof : p.base].map((color, i) => (
                  <span key={i} className="size-3.5 rounded-full border border-black/10 ring-2 ring-surface" style={{ background: color }} />
                ))}
              </span>
              {p.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
