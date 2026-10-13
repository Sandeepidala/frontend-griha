import { BriefStepFields } from '@/components/brief/BriefStepFields'
import { LOCATION_STEP, REVIEW_STEP, STEPS } from '@/components/brief/briefForm'
import { useBriefWizard } from '@/components/brief/useBriefWizard'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SidePanel } from '@/components/ui/SidePanel'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { toast } from '@/stores/useToastStore'

/** Edit brief: the project brief's steps in a side panel, over the workspace. New projects use the onboarding page. */
export function ProjectBriefPanel() {
  const panel = useProjectsStore((state) => state.briefPanel)
  const projects = useProjectsStore((state) => state.projects)
  const closePanel = useProjectsStore((state) => state.closeBriefPanel)

  // An edit waits until that project is in the list, rather than briefly showing a blank form.
  const editing = panel ? (projects.find((p) => p.id === panel.projectId) ?? null) : null
  const wizard = useBriefWizard({
    editing,
    resetKey: editing ? `edit:${editing.id}:${panel?.startAt ?? ''}` : null,
    startStep: panel?.startAt === 'location' ? LOCATION_STEP : REVIEW_STEP,
  })
  const { step, error, isSubmitting } = wizard

  async function save() {
    const project = await wizard.submit()
    if (!project) return
    toast.success('Brief updated')
    closePanel()
  }

  return (
    <SidePanel
      open={!!editing}
      onClose={closePanel}
      title={editing ? `Brief — ${editing.name}` : 'Brief'}
      description="Your plot, budget and household. Design checks, cost estimates and generated layouts all start from this."
      defaultWidth={460}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" onClick={step === 0 ? closePanel : wizard.back} disabled={isSubmitting}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step === REVIEW_STEP ? (
            <Button onClick={save} isLoading={isSubmitting}>
              Save changes
            </Button>
          ) : (
            <Button onClick={wizard.next}>Next</Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-2 border-b border-border px-5 py-3">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="font-medium text-text">{STEPS[step]}</span>
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
        <ProgressBar value={step + 1} max={STEPS.length} />
      </div>

      <Alert open={!!error} onClose={() => wizard.setError(null)} variant="danger" title="Check the brief">
        {error}
      </Alert>

      <div className="px-5 py-4">
        <BriefStepFields wizard={wizard} />
      </div>
    </SidePanel>
  )
}
