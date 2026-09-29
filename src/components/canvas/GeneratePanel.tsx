import { useEffect, useState } from 'react'
import { AlertTriangle, RefreshCw, XCircle } from 'lucide-react'
import { PlanThumbnail } from '@/components/canvas/PlanThumbnail'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SidePanel } from '@/components/ui/SidePanel'
import { Spinner } from '@/components/ui/Spinner'
import { formatLakhs } from '@/lib/boq'
import { scoreVariant } from '@/lib/designCheck'
import { generateOptions, type GenerateResult, type GeneratedOption } from '@/lib/generator'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { toast } from '@/stores/useToastStore'

const BUDGET_VARIANT = { within: 'success', close: 'warning', over: 'danger' } as const

function OptionCard({ option, onUse, busy }: { option: GeneratedOption; onUse: () => void; busy: boolean }) {
  const plot = useDesignStore((state) => state.plot)
  const issues = option.report.results.filter((r) => r.status !== 'pass').slice(0, 3)
  const bedrooms = option.floors.flatMap((f) => f.rooms).filter((r) => r.type === 'bedroom').length
  const bathrooms = option.floors.flatMap((f) => f.rooms).filter((r) => r.type === 'wet').length

  return (
    <article className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-text">{option.label}</h3>
        <div className="flex items-center gap-1.5">
          <Badge variant={scoreVariant(option.report.score)} className="font-mono tabular-nums">
            Score {option.report.score}
          </Badge>
          <Badge variant={option.estimate.budget ? BUDGET_VARIANT[option.estimate.budget.status] : 'neutral'} className="font-mono tabular-nums">
            {formatLakhs(option.estimate.total)}
          </Badge>
        </div>
      </div>
      <p className="text-xs text-text-muted">
        {option.estimate.builtUpArea.toLocaleString('en-IN')} sq ft · {bedrooms} bedrooms · {bathrooms} bathrooms
        {option.summary && <> · {option.summary}</>}
      </p>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${option.floors.length}, minmax(0, 1fr))` }}>
        {option.floors.map((floor) => (
          <figure key={floor.id} className="flex flex-col gap-1">
            <PlanThumbnail plot={plot} floor={floor} className="aspect-square w-full rounded-sm bg-surface-2" />
            <figcaption className="text-center text-[11px] text-text-muted">{floor.name}</figcaption>
          </figure>
        ))}
      </div>
      {issues.length > 0 && (
        <ul className="flex flex-col gap-1">
          {issues.map((issue) => (
            <li key={issue.id} className="flex items-start gap-1.5 text-xs text-text-muted">
              {issue.status === 'fail' ? (
                <XCircle className="mt-px size-3.5 shrink-0 text-danger" />
              ) : (
                <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" />
              )}
              {issue.title}
            </li>
          ))}
        </ul>
      )}
      <Button onClick={onUse} isLoading={busy} className="mt-auto">
        Use this layout
      </Button>
    </article>
  )
}

function GenerateBody({ onApplied }: { onApplied: () => void }) {
  const plot = useDesignStore((state) => state.plot)
  const floors = useDesignStore((state) => state.floors)
  const projectId = useDesignStore((state) => state.projectId)
  const replaceLayout = useDesignStore((state) => state.replaceLayout)
  const project = useProjectsStore((state) => state.projects.find((p) => p.id === projectId) ?? null)
  const [attempt, setAttempt] = useState(0)
  // Each result remembers the inputs it came from; a stale one counts as "still generating".
  const [generated, setGenerated] = useState<{ key: string; result: GenerateResult } | null>(null)
  const [confirming, setConfirming] = useState<GeneratedOption | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  const brief = project?.brief
  const budget = project?.budget
  const turnkey = project?.turnkey
  const key = JSON.stringify({ plot, brief, budget, turnkey, attempt })
  const result = generated?.key === key ? generated.result : null
  useEffect(() => {
    if (!brief) return
    // Let the spinner paint before the (fraction-of-a-second) generation runs.
    const timer = window.setTimeout(() => {
      const result = generateOptions({
        plot,
        brief,
        budget: budget !== undefined && turnkey !== undefined ? { amount: budget, turnkey } : null,
        seed: attempt === 0 ? undefined : (attempt * 2654435761) >>> 0,
      })
      setGenerated({ key, result })
    }, 30)
    return () => window.clearTimeout(timer)
  }, [key, plot, brief, budget, turnkey, attempt])

  if (!project || !brief) {
    return <p className="px-5 py-4 text-sm text-text-muted">Open a project with a brief to generate layouts.</p>
  }

  const hasPlan = floors.some((f) => f.rooms.length > 0)

  async function apply(option: GeneratedOption) {
    setConfirming(null)
    setApplying(option.id)
    try {
      await replaceLayout(option.floors, `Layout generated: ${option.label} (score ${option.report.score}, ${formatLakhs(option.estimate.total)})`)
      toast.success(`${option.label} is now your plan`)
      onApplied()
    } catch (err) {
      toast.danger(err instanceof Error ? err.message : "Couldn't apply the layout.")
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-muted">
          Built from your brief, then checked and costed. Pick one to edit further, or regenerate for different ideas.
        </p>
        <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)} disabled={!result} className="gap-2">
          <RefreshCw className="size-4" />
          Regenerate
        </Button>
      </div>

      {!result ? (
        <div className="flex flex-col items-center gap-3 py-16 text-sm text-text-muted">
          <Spinner size="lg" />
          Generating layouts…
        </div>
      ) : !result.ok ? (
        <p className="rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">{result.reason}</p>
      ) : (
        <>
          {result.notes.map((note) => (
            <p key={note} className="flex gap-2 rounded-md bg-warning-soft px-4 py-3 text-sm text-text">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              {note}
            </p>
          ))}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {result.options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                busy={applying === option.id}
                onUse={() => (hasPlan ? setConfirming(option) : apply(option))}
              />
            ))}
          </div>
          <p className="text-xs text-text-faint">
            Generated layouts are a starting point: rooms are placed in bands (public at the front, service in the middle,
            bedrooms at the rear) and sized to your plot. Doors, windows and structure follow in the drawings; an architect
            should review before construction.
          </p>
        </>
      )}

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={`Use ${confirming?.label ?? 'this layout'}?`}
        description="This replaces every floor and room of the current plan. It can't be undone."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => confirming && apply(confirming)}>
              Replace my plan
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text-muted">Your brief, budget and project settings stay as they are.</p>
      </Modal>
    </div>
  )
}

/** Layout options generated from the brief (project document §7), each with its design score and cost. */
export function GeneratePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title="Generate layouts"
      description="Floor plan options from your brief, each checked and costed."
      defaultWidth={760}
    >
      {open && <GenerateBody onApplied={onClose} />}
    </SidePanel>
  )
}

