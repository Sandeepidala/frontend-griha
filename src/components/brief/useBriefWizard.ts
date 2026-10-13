import { useState } from 'react'
import { type PlotFromBoundary, plotFromBoundary } from '@/lib/geo/plot'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { toast } from '@/stores/useToastStore'
import type { ExtraRoom, ProjectBrief } from '@/types/brief'
import type { ProjectSummary, SiteLocation } from '@/types/project'
import {
  BUDGET_STEP,
  LOCATION_STEP,
  NEW_PROJECT_FORM,
  PLOT_STEP,
  ROOMS_STEP,
  SITE_STEP,
  STYLE_STEP,
  type FormState,
  type StepIndex,
  formFromProject,
  matchState,
  validateStep,
} from './briefForm'

interface WizardOptions {
  /** The project whose brief is being edited; null for a new project. */
  editing: ProjectSummary | null
  /** Changes whenever the wizard opens for a different purpose; the form and step then start over. */
  resetKey: string | null
  startStep: StepIndex
}

/**
 * The project brief wizard's state and actions, shared by the new-project page and the Edit brief
 * panel: the form, the current step, validation, and saving.
 */
export function useBriefWizard({ editing, resetKey, startStep }: WizardOptions) {
  const createProject = useProjectsStore((state) => state.createProject)
  const updateProjectBrief = useProjectsStore((state) => state.updateProjectBrief)

  const [form, setForm] = useState<FormState>(NEW_PROJECT_FORM)
  const [step, setStep] = useState<StepIndex>(startStep)
  // The furthest step reached, so the stepper can jump back and forth among steps already seen.
  const [reached, setReached] = useState<StepIndex>(startStep)
  const [error, setError] = useState<string | null>(null)
  // The location picker's plot marking, while unfinished: leaving the step then would drop the corners.
  const [markingPlot, setMarkingPlot] = useState<'corners' | 'road' | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  // The marked boundary the plot size was last taken from (or that the project already had).
  const [appliedBoundary, setAppliedBoundary] = useState<string | null>(null)
  if (resetKey !== loadedKey) {
    setLoadedKey(resetKey)
    const initial = editing ? formFromProject(editing) : NEW_PROJECT_FORM
    setAppliedBoundary(boundaryKey(initial.site))
    setForm(initial)
    setStep(startStep)
    setReached(editing ? (6 as StepIndex) : startStep)
    setError(null)
  }

  const brief = form.brief
  const setBrief = (patch: Partial<ProjectBrief>) => setForm((prev) => ({ ...prev, brief: { ...prev.brief, ...patch } }))
  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }))

  function setSite(site: SiteLocation | null) {
    setForm((prev) => ({
      ...prev,
      site,
      brief: site ? { ...prev.brief, state: matchState(site) ?? prev.brief.state, city: site.city ?? prev.brief.city } : prev.brief,
    }))
  }

  function goTo(target: StepIndex) {
    if (step === LOCATION_STEP && target !== LOCATION_STEP && markingPlot) return setError(unfinishedPlotMessage(markingPlot))
    setError(null)
    setStep(target)
    setReached((prev) => (target > prev ? target : prev))
  }

  function applyPlotFromMap(plot: PlotFromBoundary) {
    setAppliedBoundary(boundaryKey(form.site))
    setForm((prev) => ({
      ...prev,
      plotWidth: String(plot.width),
      plotHeight: String(plot.height),
      facing: plot.facing,
      brief: {
        ...prev.brief,
        plotShape: plot.shape,
        plotShapeNotes:
          plot.shape === 'rectangular' ? null : `Sides measured on the map, in order from the road side: ${plot.sidesFt.map((s) => `${s} ft`).join(', ')}.`,
      },
    }))
    toast.success('Plot size, facing and shape filled in from the map. Next: what the map says about the site.')
    setError(null)
    setStep(SITE_STEP)
    setReached((prev) => (SITE_STEP > prev ? SITE_STEP : prev))
  }

  /** Makes another side the road side: facing, rotation and the plan's origin follow. */
  function applyRoadEdge(edge: number) {
    const site = form.site
    if (!site?.boundary) return
    const plot = plotFromBoundary(site.boundary, edge)
    setForm((prev) => ({
      ...prev,
      plotWidth: String(plot.width),
      plotHeight: String(plot.height),
      facing: plot.facing,
      site: prev.site && { ...prev.site, roadEdge: edge, rotationDeg: plot.rotationDeg, origin: plot.origin, report: null },
    }))
    toast.info(`Road side changed: the plot now faces ${plot.facing}.`)
  }

  function toggleRoom(room: ExtraRoom) {
    setBrief({ extraRooms: brief.extraRooms.includes(room) ? brief.extraRooms.filter((r) => r !== room) : [...brief.extraRooms, room] })
  }

  function next() {
    // A plot marked just now: take its size, facing and shape, rather than leave the old numbers.
    const site = form.site
    if (step === LOCATION_STEP && !markingPlot && site?.boundary && site.roadEdge !== null && boundaryKey(site) !== appliedBoundary) {
      return applyPlotFromMap(plotFromBoundary(site.boundary, site.roadEdge))
    }
    const problem = validateStep(step, form)
    if (problem) return setError(problem)
    goTo((step + 1) as StepIndex)
  }

  function back() {
    if (step > 0) goTo((step - 1) as StepIndex)
  }

  /** Saves the brief: creates the project, or updates the one being edited. Null when it didn't save. */
  async function submit(): Promise<ProjectSummary | null> {
    for (const s of [LOCATION_STEP, SITE_STEP, PLOT_STEP, BUDGET_STEP, ROOMS_STEP, STYLE_STEP]) {
      const problem = validateStep(s, form)
      if (problem) {
        setStep(s)
        setError(problem)
        return null
      }
    }
    const input = {
      name: form.name.trim(),
      plotWidth: Number(form.plotWidth),
      plotHeight: Number(form.plotHeight),
      facing: form.facing,
      budget: Number(form.budget),
      turnkey: form.turnkey,
      notes: form.notes.trim() || undefined,
      site: form.site,
      brief: {
        ...brief,
        city: brief.city?.trim() || null,
        plotShapeNotes: brief.plotShape === 'rectangular' ? null : brief.plotShapeNotes?.trim() || null,
      },
    }

    setIsSubmitting(true)
    try {
      if (editing) {
        const project = await updateProjectBrief(editing.id, input)
        // Keep an open plan editor in step with the new plot size and facing.
        const design = useDesignStore.getState()
        if (design.projectId === editing.id) {
          design.updatePlot({ width: input.plotWidth, height: input.plotHeight, facing: input.facing })
        }
        return project
      }
      return await createProject(input)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the brief.')
      return null
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    form,
    brief,
    step,
    reached,
    error,
    isSubmitting,
    /** Remounts the location picker whenever the wizard starts over, so its map starts on the right pin. */
    pickerKey: loadedKey ?? 'closed',
    setForm,
    setField,
    setBrief,
    setSite,
    setError,
    setMarkingPlot,
    applyPlotFromMap,
    applyRoadEdge,
    toggleRoom,
    goTo,
    next,
    back,
    submit,
  }
}

export type BriefWizard = ReturnType<typeof useBriefWizard>

function boundaryKey(site: SiteLocation | null) {
  return site?.boundary ? JSON.stringify([site.boundary, site.roadEdge]) : null
}

function unfinishedPlotMessage(marking: 'corners' | 'road') {
  return marking === 'corners'
    ? 'Finish marking the plot: click all 4 of its corners on the map, or press Cancel under the map.'
    : 'Finish marking the plot: click the side of the plot that faces the road, or press Cancel under the map.'
}
