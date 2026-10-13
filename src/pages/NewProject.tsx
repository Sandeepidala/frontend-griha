import { useState } from 'react'
import { Check } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { BriefPreview } from '@/components/brief/BriefPreview'
import { BriefStepFields } from '@/components/brief/BriefStepFields'
import { LOCATION_STEP, REVIEW_STEP, STEPS, STEP_INTROS, type StepIndex } from '@/components/brief/briefForm'
import { useBriefWizard } from '@/components/brief/useBriefWizard'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Divider } from '@/components/ui/Divider'
import { Logo } from '@/components/widgets/Logo'
import { ThemeToggle } from '@/components/widgets/ThemeToggle'
import { cn } from '@/lib/cn'
import { toast } from '@/stores/useToastStore'

function Stepper({ step, reached, onGoTo }: { step: StepIndex; reached: StepIndex; onGoTo: (step: StepIndex) => void }) {
  return (
    <ol className="flex items-center" aria-label="Steps">
      {STEPS.map((label, i) => {
        const index = i as StepIndex
        const done = index < step
        const current = index === step
        const reachable = index <= reached
        return (
          <li key={label} className={cn('flex items-center', i < STEPS.length - 1 && 'flex-1')}>
            <button
              type="button"
              onClick={() => onGoTo(index)}
              disabled={!reachable || current}
              title={label}
              aria-label={`Step ${i + 1}: ${label}`}
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors',
                current && 'border-primary bg-primary text-on-primary',
                done && !current && 'border-primary bg-primary-soft text-primary hover:bg-primary hover:text-on-primary',
                !done && !current && reachable && 'border-border-strong text-text hover:border-primary',
                !reachable && 'cursor-not-allowed border-border text-text-faint',
              )}
            >
              {done ? <Check className="size-3.5" /> : i + 1}
            </button>
            {i < STEPS.length - 1 && <span className={cn('mx-1 h-px flex-1', index < step ? 'bg-primary' : 'bg-border')} />}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Creating a project: the brief, step by step, on the left; on the right, what it adds up to: the map
 * to find and mark the plot, then the plot to scale with the building rules, a concept plan and its cost.
 */
export function NewProject() {
  const navigate = useNavigate()
  const wizard = useBriefWizard({ editing: null, resetKey: 'create', startStep: LOCATION_STEP })
  const { step, reached, error, isSubmitting } = wizard
  // The large map's element. Set again each time the Location step opens, so the map is made in it.
  const [mapTarget, setMapTarget] = useState<HTMLDivElement | null>(null)

  async function create() {
    const project = await wizard.submit()
    if (!project) return
    navigate(`/projects/${project.id}`)
    toast.success(`${project.name} created — opening workspace`)
  }

  const onLocation = step === LOCATION_STEP

  return (
    <div className="flex min-h-svh flex-col bg-bg lg:h-svh">
      <header
        className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-1 border-b border-border bg-surface px-4 sm:px-6"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <Link to="/" aria-label="Griha dashboard">
          <Logo />
        </Link>
        <Divider orientation="vertical" className="mx-2 h-5" />
        <span className="text-sm font-medium text-text">New project</span>
        <div className="flex-1" />
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} disabled={isSubmitting}>
          Cancel
        </Button>
      </header>

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <aside className="flex flex-col border-border bg-surface lg:min-h-0 lg:w-[460px] lg:shrink-0 lg:border-r xl:w-[500px]">
          <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:px-6">
            <Stepper step={step} reached={reached} onGoTo={wizard.goTo} />
            <div>
              <p className="text-xs font-medium text-text-muted">
                Step {step + 1} of {STEPS.length}
              </p>
              <h1 className="font-display text-xl font-semibold text-text">{STEPS[step]}</h1>
              <p className="mt-1 text-sm text-text-muted">{STEP_INTROS[step]}</p>
            </div>
          </div>

          <Alert open={!!error} onClose={() => wizard.setError(null)} variant="danger" title="Check the brief">
            {error}
          </Alert>

          <div className="flex-1 px-5 py-5 sm:px-6 lg:overflow-y-auto">
            {/* The Location step waits for its map's element, so the map is made in the right place. */}
            {(!onLocation || mapTarget) && <BriefStepFields wizard={wizard} mapTarget={onLocation ? mapTarget : undefined} hideLocationIntro />}
          </div>

          <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-surface px-5 py-3 sm:px-6">
            <Button variant="ghost" onClick={step === 0 ? () => navigate('/') : wizard.back} disabled={isSubmitting}>
              {step === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step === REVIEW_STEP ? (
              <Button onClick={create} isLoading={isSubmitting}>
                Create project
              </Button>
            ) : (
              <Button onClick={wizard.next}>Next</Button>
            )}
          </div>
        </aside>

        <main className={cn('flex-1 lg:min-h-0', onLocation ? 'relative h-[65svh] lg:h-auto' : 'overflow-y-auto')}>
          {onLocation ? (
            <div ref={setMapTarget} className="absolute inset-0" data-testid="new-project-map" />
          ) : (
            <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
              <BriefPreview form={wizard.form} step={step} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
