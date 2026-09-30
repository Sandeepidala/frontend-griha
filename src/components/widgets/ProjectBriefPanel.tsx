import { Suspense, lazy, useState, type ReactNode } from 'react'
import { IndianRupee, Minus, Plus, Ruler } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { RadioGroup } from '@/components/ui/Radio'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { SidePanel } from '@/components/ui/SidePanel'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import {
  BRIEF_LIMITS,
  DEFAULT_BRIEF,
  EXTRA_ROOM_OPTIONS,
  FAMILY_TYPE_OPTIONS,
  INDIAN_STATES,
  KITCHEN_OPTIONS,
  PLOT_SHAPE_OPTIONS,
  STYLE_OPTIONS,
  floorsLabel,
} from '@/lib/brief'
import { formatCurrency } from '@/lib/format'
import type { PlotFromBoundary } from '@/lib/geo/plot'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { toast } from '@/stores/useToastStore'
import type { ExtraRoom, ProjectBrief } from '@/types/brief'
import type { Plot } from '@/types/design'
import type { ProjectSummary, SiteLocation } from '@/types/project'
import { FormField } from './FormField'

// The map (MapLibre) loads only when the Location step opens.
const LocationPicker = lazy(() => import('@/components/site/LocationPicker').then((m) => ({ default: m.LocationPicker })))

const STEPS = ['Location', 'Plot', 'Budget', 'Family & rooms', 'Style', 'Review'] as const
type StepIndex = 0 | 1 | 2 | 3 | 4 | 5
const LOCATION_STEP: StepIndex = 0
const PLOT_STEP: StepIndex = 1
const BUDGET_STEP: StepIndex = 2
const ROOMS_STEP: StepIndex = 3
const STYLE_STEP: StepIndex = 4
const REVIEW_STEP: StepIndex = 5

interface FormState {
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

const NEW_PROJECT_FORM: FormState = {
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

function formFromProject(project: ProjectSummary): FormState {
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
function matchState(site: SiteLocation): string | null {
  if (!site.state) return null
  if (site.countryCode && site.countryCode !== 'IN') return site.state
  return INDIAN_STATES.find((s) => s.toLowerCase() === site.state!.toLowerCase()) ?? null
}

const FACING_LABELS: Record<Plot['facing'], string> = { north: 'North', south: 'South', east: 'East', west: 'West' }

/** Returns an error message for the first problem on a step, or null when it's complete. */
function validateStep(step: StepIndex, form: FormState): string | null {
  if (step === PLOT_STEP) {
    if (!form.name.trim()) return 'Give your project a name to continue.'
    if (!(Number(form.plotWidth) > 0) || !(Number(form.plotHeight) > 0)) return 'Enter valid plot dimensions.'
    if (form.brief.plotShape !== 'rectangular' && !form.brief.plotShapeNotes?.trim())
      return 'Describe how the plot differs from a rectangle, so the design team can account for it.'
  }
  if (step === BUDGET_STEP && !(Number(form.budget) > 0)) return 'Enter a budget amount.'
  return null
}

function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium text-text">{label}</span>
      <div className="flex items-center gap-1">
        <IconButton label={`Fewer ${label.toLowerCase()}`} size="sm" variant="outline" disabled={value <= min} onClick={() => onChange(value - 1)}>
          <Minus className="size-4" />
        </IconButton>
        <span className="w-8 text-center font-mono text-sm tabular-nums text-text" aria-live="polite">
          {value}
        </span>
        <IconButton label={`More ${label.toLowerCase()}`} size="sm" variant="outline" disabled={value >= max} onClick={() => onChange(value + 1)}>
          <Plus className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="text-right font-medium text-text">{value}</span>
    </div>
  )
}

function ReviewSection({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border px-4 py-3">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <button type="button" onClick={onEdit} className="text-xs font-medium text-primary hover:underline">
          Edit
        </button>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  )
}

export function ProjectBriefPanel() {
  const panel = useProjectsStore((state) => state.briefPanel)
  const projects = useProjectsStore((state) => state.projects)
  const closePanel = useProjectsStore((state) => state.closeBriefPanel)
  const createProject = useProjectsStore((state) => state.createProject)
  const updateProjectBrief = useProjectsStore((state) => state.updateProjectBrief)
  const navigate = useNavigate()

  const editing = panel?.mode === 'edit' ? (projects.find((p) => p.id === panel.projectId) ?? null) : null
  const [form, setForm] = useState<FormState>(NEW_PROJECT_FORM)
  const [step, setStep] = useState<StepIndex>(0)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Reset the wizard whenever it opens for a different purpose (new project, or another project's brief).
  // An edit waits until that project is in the list, rather than briefly showing a blank new-project form.
  const panelKey = panel?.mode === 'create' ? 'create' : editing ? `edit:${editing.id}` : null
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  if (panelKey !== loadedKey) {
    setLoadedKey(panelKey)
    setForm(editing ? formFromProject(editing) : NEW_PROJECT_FORM)
    setStep(editing ? REVIEW_STEP : 0)
    setError(null)
  }

  const setBrief = (patch: Partial<ProjectBrief>) => setForm((prev) => ({ ...prev, brief: { ...prev.brief, ...patch } }))
  const brief = form.brief

  function setSite(site: SiteLocation | null) {
    setForm((prev) => ({
      ...prev,
      site,
      brief: site ? { ...prev.brief, state: matchState(site) ?? prev.brief.state, city: site.city ?? prev.brief.city } : prev.brief,
    }))
  }

  function applyPlotFromMap(plot: PlotFromBoundary) {
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
    toast.success('Plot size, facing and shape filled in from the map. Check them on the next step.')
    goTo(PLOT_STEP)
  }

  function toggleRoom(room: ExtraRoom) {
    setBrief({
      extraRooms: brief.extraRooms.includes(room)
        ? brief.extraRooms.filter((r) => r !== room)
        : [...brief.extraRooms, room],
    })
  }

  function goTo(target: StepIndex) {
    setError(null)
    setStep(target)
  }

  function next() {
    const problem = validateStep(step, form)
    if (problem) return setError(problem)
    goTo((step + 1) as StepIndex)
  }

  async function handleSubmit() {
    for (const s of [LOCATION_STEP, PLOT_STEP, BUDGET_STEP, ROOMS_STEP, STYLE_STEP]) {
      const problem = validateStep(s, form)
      if (problem) {
        setStep(s)
        return setError(problem)
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
        await updateProjectBrief(editing.id, input)
        // Keep an open plan editor in step with the new plot size and facing.
        const design = useDesignStore.getState()
        if (design.projectId === editing.id) {
          design.updatePlot({ width: input.plotWidth, height: input.plotHeight, facing: input.facing })
        }
        toast.success('Brief updated')
        closePanel()
      } else {
        const project = await createProject(input)
        closePanel()
        navigate(`/projects/${project.id}`)
        toast.success(`${project.name} created — opening workspace`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the brief.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const styleLabel = STYLE_OPTIONS.find((o) => o.value === brief.style)?.label ?? brief.style
  const extraRoomsLabel =
    brief.extraRooms.map((r) => EXTRA_ROOM_OPTIONS.find((o) => o.value === r)?.label ?? r).join(', ') || 'None'

  return (
    <SidePanel
      open={panelKey !== null}
      onClose={closePanel}
      title={editing ? `Brief — ${editing.name}` : 'New project'}
      description="Your plot, budget and household. Design checks, cost estimates and generated layouts all start from this."
      defaultWidth={460}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button variant="ghost" onClick={step === 0 ? closePanel : () => goTo((step - 1) as StepIndex)} disabled={isSubmitting}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step === REVIEW_STEP ? (
            <Button onClick={handleSubmit} isLoading={isSubmitting}>
              {editing ? 'Save changes' : 'Create project'}
            </Button>
          ) : (
            <Button onClick={next}>Next</Button>
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

      <Alert open={!!error} onClose={() => setError(null)} variant="danger" title="Check the brief">
        {error}
      </Alert>

      <div className="flex flex-col gap-5 px-5 py-4">
        {step === LOCATION_STEP && (
          <>
            <p className="text-sm text-text-muted">
              Find the plot on the map. Marking its corners measures it and sets which way it faces; you can also skip this and
              enter the plot by hand.
            </p>
            <Suspense fallback={<div className="h-72 animate-pulse rounded-md bg-surface-2" />}>
              <LocationPicker value={form.site} onChange={setSite} onUsePlot={applyPlotFromMap} />
            </Suspense>
          </>
        )}

        {step === PLOT_STEP && (
          <>
            <FormField label="Project name" required>
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="e.g. Sharma Residence"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Plot width" required hint="in feet">
                <Input
                  type="number"
                  min={0}
                  leftSlot={<Ruler />}
                  value={form.plotWidth}
                  onChange={(event) => setForm((prev) => ({ ...prev, plotWidth: event.target.value }))}
                />
              </FormField>
              <FormField label="Plot length" required hint="in feet">
                <Input
                  type="number"
                  min={0}
                  leftSlot={<Ruler />}
                  value={form.plotHeight}
                  onChange={(event) => setForm((prev) => ({ ...prev, plotHeight: event.target.value }))}
                />
              </FormField>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text">Plot shape</span>
              <SegmentedControl
                value={brief.plotShape}
                onChange={(plotShape) => setBrief({ plotShape })}
                options={PLOT_SHAPE_OPTIONS}
                className="grid w-full grid-cols-3"
              />
            </div>
            {brief.plotShape !== 'rectangular' && (
              <FormField label="How does the shape differ?" required hint="Widths and lengths above are the main sides; describe the rest">
                <Textarea
                  value={brief.plotShapeNotes ?? ''}
                  onChange={(event) => setBrief({ plotShapeNotes: event.target.value })}
                  placeholder="e.g. Rear side is 26 ft instead of 30 ft; the east boundary is angled."
                />
              </FormField>
            )}
            <FormField label="Facing direction" required hint="The side the main road is on, as per the sale deed">
              <Select
                value={form.facing}
                onChange={(event) => setForm((prev) => ({ ...prev, facing: event.target.value as Plot['facing'] }))}
              >
                {Object.entries(FACING_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text">Corner plot</p>
                <p className="text-xs text-text-muted">Roads on two sides</p>
              </div>
              <Switch checked={brief.cornerPlot} onChange={(event) => setBrief({ cornerPlot: event.target.checked })} />
            </div>
            <FormField label="Road width in front" hint="In feet; sets the floor-area and height limits. Leave blank if unsure.">
              <Input
                type="number"
                min={0}
                leftSlot={<Ruler />}
                value={brief.roadWidthFt ?? ''}
                onChange={(event) => setBrief({ roadWidthFt: Number(event.target.value) > 0 ? Number(event.target.value) : null })}
                placeholder="e.g. 30"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label={form.site?.countryCode && form.site.countryCode !== 'IN' ? 'State / region' : 'State'} hint="For local rates and building rules">
                {form.site?.countryCode && form.site.countryCode !== 'IN' ? (
                  <Input value={brief.state ?? ''} onChange={(event) => setBrief({ state: event.target.value || null })} />
                ) : (
                  <Select value={brief.state ?? ''} onChange={(event) => setBrief({ state: event.target.value || null })}>
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </Select>
                )}
              </FormField>
              <FormField label="City / town">
                <Input
                  value={brief.city ?? ''}
                  onChange={(event) => setBrief({ city: event.target.value })}
                  placeholder="e.g. Mysuru"
                />
              </FormField>
            </div>
          </>
        )}

        {step === BUDGET_STEP && (
          <>
            <FormField
              label="Total budget"
              required
              hint={Number(form.budget) > 0 ? formatCurrency(Number(form.budget)) : 'In ₹'}
            >
              <Input
                type="number"
                min={0}
                leftSlot={<IndianRupee />}
                value={form.budget}
                onChange={(event) => setForm((prev) => ({ ...prev, budget: event.target.value }))}
              />
            </FormField>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text">What the budget covers</span>
              <RadioGroup
                name="budget-scope"
                value={form.turnkey ? 'turnkey' : 'construction'}
                onChange={(value) => setForm((prev) => ({ ...prev, turnkey: value === 'turnkey' }))}
                options={[
                  { value: 'construction', label: 'Construction only', description: 'Structure, walls, roof, plumbing and wiring' },
                  { value: 'turnkey', label: 'Turnkey', description: 'Construction plus interiors and finishing, ready to move in' },
                ]}
              />
            </div>
          </>
        )}

        {step === ROOMS_STEP && (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text">Floors</span>
              <SegmentedControl
                value={String(brief.floors)}
                onChange={(value) => setBrief({ floors: Number(value) })}
                options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: floorsLabel(n) }))}
                className="grid w-full grid-cols-4"
              />
            </div>
            <div className="flex flex-col gap-3 rounded-md border border-border px-4 py-3">
              <NumberStepper label="Bedrooms" value={brief.bedrooms} {...BRIEF_LIMITS.bedrooms} onChange={(bedrooms) => setBrief({ bedrooms })} />
              <NumberStepper label="Bathrooms" value={brief.bathrooms} {...BRIEF_LIMITS.bathrooms} onChange={(bathrooms) => setBrief({ bathrooms })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text">Kitchen</span>
                <SegmentedControl
                  value={brief.kitchenType}
                  onChange={(kitchenType) => setBrief({ kitchenType })}
                  options={KITCHEN_OPTIONS}
                  className="grid w-full grid-cols-2"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text">Car parking</span>
                <SegmentedControl
                  value={String(brief.parkingCars)}
                  onChange={(value) => setBrief({ parkingCars: Number(value) })}
                  options={[0, 1, 2, 3].map((n) => ({ value: String(n), label: n === 0 ? 'None' : String(n) }))}
                  className="grid w-full grid-cols-4"
                />
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-text">Additional rooms</p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {EXTRA_ROOM_OPTIONS.map((room) => (
                  <label key={room.value} className="flex items-start gap-2.5 text-sm text-text">
                    <Checkbox checked={brief.extraRooms.includes(room.value)} onChange={() => toggleRoom(room.value)} />
                    <span>
                      {room.label}
                      {room.hint && <span className="block text-xs text-text-muted">{room.hint}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-md border border-border px-4 py-3">
              <NumberStepper label="Family members" value={brief.familySize} {...BRIEF_LIMITS.familySize} onChange={(familySize) => setBrief({ familySize })} />
              <SegmentedControl
                value={brief.familyType}
                onChange={(familyType) => setBrief({ familyType })}
                options={FAMILY_TYPE_OPTIONS}
                className="grid w-full grid-cols-2"
              />
              <p className="text-xs text-text-muted">Used to separate family spaces from guest areas.</p>
            </div>
            <label className="flex items-start gap-2.5 text-sm text-text">
              <Checkbox
                checked={brief.needsGroundFloorBedroom}
                onChange={(event) => setBrief({ needsGroundFloorBedroom: event.target.checked })}
              />
              <span>
                Needs a ground-floor bedroom
                <span className="block text-xs text-text-muted">For elderly or less-mobile family members</span>
              </span>
            </label>
          </>
        )}

        {step === STYLE_STEP && (
          <>
            <FormField label="Style">
              <Select value={brief.style} onChange={(event) => setBrief({ style: event.target.value as ProjectBrief['style'] })}>
                {(['General', 'Regional'] as const).map((group) => (
                  <optgroup key={group} label={group}>
                    {STYLE_OPTIONS.filter((o) => o.group === group).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </FormField>
            <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-2 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text">Follow Vastu guidelines</p>
                <p className="text-xs text-text-muted">
                  Places the entrance, kitchen, bedrooms and staircase as per common Vastu practice
                </p>
              </div>
              <Switch checked={brief.vastu} onChange={(event) => setBrief({ vastu: event.target.checked })} />
            </div>
            <FormField label="Notes for the design team" hint="Optional">
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="e.g. We'd like a large verandah facing the garden."
              />
            </FormField>
          </>
        )}

        {step === REVIEW_STEP && (
          <>
            <ReviewSection title="Location" onEdit={() => goTo(LOCATION_STEP)}>
              <ReviewRow label="Address" value={form.site?.formattedAddress || (form.site ? `${form.site.lat.toFixed(5)}, ${form.site.lng.toFixed(5)}` : 'Not set')} />
              {form.site?.boundary && <ReviewRow label="Boundary" value={`Marked on the map (${form.site.boundary.length} corners)`} />}
            </ReviewSection>
            <ReviewSection title="Plot" onEdit={() => goTo(PLOT_STEP)}>
              <ReviewRow label="Project" value={form.name || '—'} />
              <ReviewRow
                label="Size"
                value={`${form.plotWidth}' × ${form.plotHeight}' · ${PLOT_SHAPE_OPTIONS.find((o) => o.value === brief.plotShape)?.label}`}
              />
              <ReviewRow label="Facing" value={`${FACING_LABELS[form.facing]}${brief.cornerPlot ? ' · Corner plot' : ''}`} />
              <ReviewRow label="Road width" value={brief.roadWidthFt ? `${brief.roadWidthFt} ft` : 'Not given'} />
              <ReviewRow label="Location" value={[brief.city, brief.state].filter(Boolean).join(', ') || 'Not given'} />
            </ReviewSection>
            <ReviewSection title="Budget" onEdit={() => goTo(BUDGET_STEP)}>
              <ReviewRow label="Amount" value={Number(form.budget) > 0 ? formatCurrency(Number(form.budget)) : '—'} />
              <ReviewRow label="Covers" value={form.turnkey ? 'Turnkey' : 'Construction only'} />
            </ReviewSection>
            <ReviewSection title="Family & rooms" onEdit={() => goTo(ROOMS_STEP)}>
              <ReviewRow label="Floors" value={floorsLabel(brief.floors)} />
              <ReviewRow label="Bedrooms / bathrooms" value={`${brief.bedrooms} / ${brief.bathrooms}`} />
              <ReviewRow
                label="Kitchen / parking"
                value={`${brief.kitchenType === 'open' ? 'Open' : 'Closed'} / ${brief.parkingCars === 0 ? 'None' : `${brief.parkingCars} car${brief.parkingCars > 1 ? 's' : ''}`}`}
              />
              <ReviewRow label="Additional rooms" value={extraRoomsLabel} />
              <ReviewRow
                label="Family"
                value={`${brief.familySize} members · ${brief.familyType === 'joint' ? 'Joint' : 'Nuclear'}${brief.needsGroundFloorBedroom ? ' · Ground-floor bedroom' : ''}`}
              />
            </ReviewSection>
            <ReviewSection title="Style" onEdit={() => goTo(STYLE_STEP)}>
              <ReviewRow label="Style" value={styleLabel} />
              <ReviewRow label="Vastu" value={brief.vastu ? 'Follow guidelines' : 'Not required'} />
              {form.notes.trim() && <ReviewRow label="Notes" value={form.notes.trim()} />}
            </ReviewSection>
          </>
        )}
      </div>
    </SidePanel>
  )
}
