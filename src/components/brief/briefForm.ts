import { DEFAULT_BRIEF, INDIAN_STATES } from '@/lib/brief'
import type { ProjectBrief } from '@/types/brief'
import type { Plot } from '@/types/design'
import type { ProjectSummary, SiteLocation } from '@/types/project'

export const STEPS = ['Location', 'Site details', 'Plot', 'Budget', 'Family & rooms', 'Style', 'Review'] as const
export type StepIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6
export const LOCATION_STEP: StepIndex = 0
export const SITE_STEP: StepIndex = 1
export const PLOT_STEP: StepIndex = 2
export const BUDGET_STEP: StepIndex = 3
export const ROOMS_STEP: StepIndex = 4
export const STYLE_STEP: StepIndex = 5
export const REVIEW_STEP: StepIndex = 6

/** One line on what each step asks, for the onboarding page's heading. */
export const STEP_INTROS: Record<StepIndex, string> = {
  0: 'Find the plot on the map and mark its corners. That measures it and sets which way it faces; you can also skip this and enter the plot by hand.',
  1: 'Roads, ground, rainfall, design zones and soil for the plot you marked. The plot drawing follows what you confirm here.',
  2: 'Name the project and confirm the plot. The drawing shows what the building rules leave you to build on.',
  3: 'What you plan to spend, and what it should cover. The estimate is for a concept plan that fits your brief.',
  4: 'Who will live here and the rooms you need. The concept plan updates as you go.',
  5: 'The look you want, Vastu, and anything else the design team should know.',
  6: 'Check everything before creating the project. You can change any of it later from Edit brief.',
}

export interface FormState {
  name: string
  plotWidth: string
  plotHeight: string
  facing: Plot['facing']
  budget: string
  turnkey: boolean
  notes: string
  brief: ProjectBrief
  site: SiteLocation | null
}

export const NEW_PROJECT_FORM: FormState = {
  name: '',
  plotWidth: '30',
  plotHeight: '40',
  facing: 'north',
  budget: '4500000',
  turnkey: false,
  notes: '',
  brief: DEFAULT_BRIEF,
  site: null,
}

export function formFromProject(project: ProjectSummary): FormState {
  return {
    name: project.name,
    plotWidth: String(project.plotWidth),
    plotHeight: String(project.plotHeight),
    facing: project.facing,
    budget: String(project.budget),
    turnkey: project.turnkey,
    notes: project.notes ?? '',
    brief: project.brief,
    site: project.site,
  }
}

/** The site's state as the brief records it: the Indian list's spelling in India, else as the map gave it. */
export function matchState(site: SiteLocation): string | null {
  if (!site.state) return null
  if (site.countryCode && site.countryCode !== 'IN') return site.state
  return INDIAN_STATES.find((s) => s.toLowerCase() === site.state!.toLowerCase()) ?? null
}

export const FACING_LABELS: Record<Plot['facing'], string> = { north: 'North', south: 'South', east: 'East', west: 'West' }

/** Returns an error message for the first problem on a step, or null when it's complete. */
export function validateStep(step: StepIndex, form: FormState): string | null {
  if (step === PLOT_STEP) {
    if (!form.name.trim()) return 'Give your project a name to continue.'
    if (!(Number(form.plotWidth) > 0) || !(Number(form.plotHeight) > 0)) return 'Enter valid plot dimensions.'
    if (form.brief.plotShape !== 'rectangular' && !form.brief.plotShapeNotes?.trim())
      return 'Describe how the plot differs from a rectangle, so the design team can account for it.'
  }
  if (step === BUDGET_STEP && !(Number(form.budget) > 0)) return 'Enter a budget amount.'
  return null
}

/** The setbacks a new project starts with (the plan editor's defaults); the bye-laws raise them where needed. */
const STARTING_SETBACKS = { front: 3, rear: 2, left: 2, right: 2 }

/** The plot as the brief so far describes it, or null while its size isn't a usable number. */
export function plotFromForm(form: FormState, setbacks = STARTING_SETBACKS): Plot | null {
  const width = Number(form.plotWidth)
  const height = Number(form.plotHeight)
  if (!(width >= 10) || !(height >= 10) || width > 2000 || height > 2000) return null
  return { width, height, facing: form.facing, units: 'ft', setbacks }
}
