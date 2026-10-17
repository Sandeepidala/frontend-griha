import { Suspense, lazy, useEffect, useState } from 'react'
import { AlertTriangle, Check, Clapperboard, RefreshCw, SquareDashed } from 'lucide-react'
import { LayoutOptionCard } from '@/components/canvas/LayoutOptionCard'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { compliantSetbacks, requirementsFor } from '@/lib/byelaws'
import { cn } from '@/lib/cn'
import { generateOptions, type GenerateResult, type GeneratedOption } from '@/lib/generator'
import { type FormState, plotFromForm } from './briefForm'

// The build animation (three.js) loads only when someone opens it.
const BuildSequenceDialog = lazy(() => import('@/components/canvas/BuildSequenceDialog').then((m) => ({ default: m.BuildSequenceDialog })))

/** What the new project starts with: one of the generated layouts, or an empty plan. */
export type LayoutChoice = { kind: 'option'; option: GeneratedOption } | { kind: 'empty' }

interface LayoutChooserProps {
  form: FormState
  choice: LayoutChoice | null
  onChoose: (choice: LayoutChoice | null) => void
}

/**
 * The finalization step's right-hand side: layout options generated from the finished brief, each
 * checked and costed. The best one is chosen to begin with; the customer can pick another, ask for
 * different ones, or start from an empty plan.
 */
export function LayoutChooser({ form, choice, onChoose }: LayoutChooserProps) {
  const [attempt, setAttempt] = useState(0)
  // The option whose build animation is open.
  const [watching, setWatching] = useState<GeneratedOption | null>(null)
  const basePlot = plotFromForm(form)
  const budget = Number(form.budget) > 0 ? { amount: Number(form.budget), turnkey: form.turnkey } : null
  const key = JSON.stringify({ plot: basePlot, brief: form.brief, budget, attempt })
  const [generated, setGenerated] = useState<{ key: string; result: GenerateResult } | null>(null)
  const result = generated?.key === key ? generated.result : null

  useEffect(() => {
    if (!basePlot) return
    // Let the spinner paint before the (fraction-of-a-second) generation runs.
    const timer = window.setTimeout(() => {
      const next = generateOptions({ plot: basePlot, brief: form.brief, budget, seed: attempt === 0 ? undefined : (attempt * 2654435761) >>> 0 })
      setGenerated({ key, result: next })
      // Start with the best option, unless the customer chose an empty plan.
      if (next.ok && choice?.kind !== 'empty') onChoose({ kind: 'option', option: next.options[0] })
    }, 30)
    return () => window.clearTimeout(timer)
    // `key` covers the plot, brief, budget and attempt; the choice is only read when new options arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!basePlot) return <p className="py-16 text-center text-sm text-text-muted">Enter the plot's size (Plot step) to see layout options.</p>
  const rules = requirementsFor(basePlot, form.brief)
  const plot = { ...basePlot, setbacks: compliantSetbacks(basePlot.setbacks, rules.setbacks) }
  const chosenId = choice?.kind === 'option' ? choice.option.id : null
  const empty = choice?.kind === 'empty'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-text-muted uppercase">Finalize</p>
          <h2 className="font-display text-xl font-semibold text-text">Choose your starting layout</h2>
          <p className="mt-0.5 text-sm text-text-muted">
            Built from your brief, then checked and costed. The project opens with the one you choose; you can edit every room afterwards.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)} disabled={!result} leftIcon={<RefreshCw className="size-4" />}>
          Show other options
        </Button>
      </div>

      {!result ? (
        <div className="flex flex-col items-center gap-3 py-16 text-sm text-text-muted">
          <Spinner size="lg" />
          Generating layouts…
        </div>
      ) : !result.ok ? (
        <p className="flex gap-2 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {result.reason}
        </p>
      ) : (
        <>
          {result.notes.map((note) => (
            <p key={note} className="flex gap-2 rounded-md bg-warning-soft px-4 py-3 text-sm text-text">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              {note}
            </p>
          ))}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {result.options.map((option, i) => {
              const selected = option.id === chosenId
              return (
                <LayoutOptionCard
                  key={option.id}
                  option={option}
                  plot={plot}
                  selected={selected}
                  tag={i === 0 ? 'Recommended' : undefined}
                  footer={
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={selected ? 'primary' : 'outline'}
                        className="flex-1"
                        leftIcon={selected ? <Check className="size-4" /> : undefined}
                        onClick={() => onChoose({ kind: 'option', option })}
                        aria-pressed={selected}
                      >
                        {selected ? 'Chosen' : 'Choose this layout'}
                      </Button>
                      <Button variant="ghost" leftIcon={<Clapperboard className="size-4" />} onClick={() => setWatching(option)}>
                        Watch it get built
                      </Button>
                    </div>
                  }
                />
              )
            })}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => onChoose({ kind: 'empty' })}
        aria-pressed={empty}
        className={cn(
          'flex items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors',
          empty ? 'border-primary bg-primary-soft' : 'border-dashed border-border-strong hover:border-primary',
        )}
      >
        <SquareDashed className="size-5 shrink-0 text-text-muted" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-text">Start with an empty plan</span>
          <span className="block text-xs text-text-muted">Draw the rooms yourself; you can still generate layouts later from the workspace.</span>
        </span>
        {empty && <Check className="size-4 shrink-0 text-primary" />}
      </button>

      {watching && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><Spinner size="lg" /></div>}>
          <BuildSequenceDialog
            onClose={() => setWatching(null)}
            title={watching.label}
            projectName={form.name.trim()}
            plot={plot}
            floors={watching.floors}
            brief={form.brief}
            estimate={watching.estimate}
            action={{
              label: watching.id === chosenId ? 'Keep this layout' : 'Choose this layout',
              onClick: () => {
                onChoose({ kind: 'option', option: watching })
                setWatching(null)
              },
            }}
          />
        </Suspense>
      )}

      <p className="text-xs text-text-faint">
        Generated layouts are a starting point: rooms are placed in bands (public at the front, service in the middle, bedrooms at the rear) and
        sized to your plot. Doors, windows and structure follow in the drawings; an architect should review before construction.
      </p>
    </div>
  )
}
