import { Suspense, lazy, type ReactNode } from 'react'
import { IndianRupee, Minus, Plus, Ruler } from 'lucide-react'
import { Checkbox } from '@/components/ui/Checkbox'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Input'
import { RadioGroup } from '@/components/ui/Radio'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'
import { Textarea } from '@/components/ui/Textarea'
import { StyleChooser } from '@/components/style/StyleChooser'
import { FormField } from '@/components/widgets/FormField'
import {
  BRIEF_LIMITS,
  EXTRA_ROOM_OPTIONS,
  FAMILY_TYPE_OPTIONS,
  INDIAN_STATES,
  KITCHEN_OPTIONS,
  PLOT_SHAPE_OPTIONS,
  floorsLabel,
} from '@/lib/brief'
import { formatCurrency } from '@/lib/format'
import { lookFor } from '@/lib/style/kits'
import type { Plot } from '@/types/design'
import {
  BUDGET_STEP,
  FACING_LABELS,
  LOCATION_STEP,
  PLOT_STEP,
  REVIEW_STEP,
  ROOMS_STEP,
  SITE_STEP,
  STYLE_STEP,
} from './briefForm'
import type { BriefWizard } from './useBriefWizard'

// The map (MapLibre) loads only when the Location step opens.
const LocationPicker = lazy(() => import('@/components/site/LocationPicker').then((m) => ({ default: m.LocationPicker })))
const SiteDetailsStep = lazy(() => import('@/components/site/SiteDetailsStep').then((m) => ({ default: m.SiteDetailsStep })))

function NumberStepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
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

interface BriefStepFieldsProps {
  wizard: BriefWizard
  /** Where the Location step's map goes; by default it sits under the search box. */
  mapTarget?: HTMLElement | null
  /** Leaves out the Location step's opening line (the onboarding page shows it as the step's heading). */
  hideLocationIntro?: boolean
}

/** The current step's fields of the project brief. */
export function BriefStepFields({ wizard, mapTarget, hideLocationIntro }: BriefStepFieldsProps) {
  const { form, brief, step, setField, setBrief, setSite, goTo } = wizard
  const look = lookFor(brief)
  const styleLabel = `${look.kit.name} · ${look.palette.name}`
  const extraRoomsLabel = brief.extraRooms.map((r) => EXTRA_ROOM_OPTIONS.find((o) => o.value === r)?.label ?? r).join(', ') || 'None'
  const abroad = !!form.site?.countryCode && form.site.countryCode !== 'IN'

  return (
    <div className="flex flex-col gap-5">
      {step === LOCATION_STEP && (
        <>
          {!hideLocationIntro && (
            <p className="text-sm text-text-muted">
              Find the plot on the map. Marking its corners measures it and sets which way it faces; you can also skip this and enter the
              plot by hand.
            </p>
          )}
          <Suspense fallback={<div className="h-72 animate-pulse rounded-md bg-surface-2" />}>
            <LocationPicker
              key={wizard.pickerKey}
              value={form.site}
              onChange={setSite}
              onUsePlot={wizard.applyPlotFromMap}
              onMarkingChange={wizard.setMarkingPlot}
              mapTarget={mapTarget}
            />
          </Suspense>
        </>
      )}

      {step === SITE_STEP && (
        <Suspense fallback={<div className="h-72 animate-pulse rounded-md bg-surface-2" />}>
          <SiteDetailsStep
            site={form.site}
            onChange={setSite}
            brief={brief}
            setBrief={setBrief}
            onUseRoadEdge={wizard.applyRoadEdge}
            onGoToLocation={() => goTo(LOCATION_STEP)}
          />
        </Suspense>
      )}

      {step === PLOT_STEP && (
        <>
          <FormField label="Project name" required>
            <Input value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="e.g. Sharma Residence" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Plot width" required hint="in feet">
              <Input type="number" min={0} leftSlot={<Ruler />} value={form.plotWidth} onChange={(event) => setField('plotWidth', event.target.value)} />
            </FormField>
            <FormField label="Plot length" required hint="in feet">
              <Input type="number" min={0} leftSlot={<Ruler />} value={form.plotHeight} onChange={(event) => setField('plotHeight', event.target.value)} />
            </FormField>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text">Plot shape</span>
            <SegmentedControl value={brief.plotShape} onChange={(plotShape) => setBrief({ plotShape })} options={PLOT_SHAPE_OPTIONS} className="grid w-full grid-cols-3" />
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
            <Select value={form.facing} onChange={(event) => setField('facing', event.target.value as Plot['facing'])}>
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
            <FormField label={abroad ? 'State / region' : 'State'} hint="For local rates and building rules">
              {abroad ? (
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
              <Input value={brief.city ?? ''} onChange={(event) => setBrief({ city: event.target.value })} placeholder="e.g. Mysuru" />
            </FormField>
          </div>
        </>
      )}

      {step === BUDGET_STEP && (
        <>
          <FormField label="Total budget" required hint={Number(form.budget) > 0 ? formatCurrency(Number(form.budget)) : 'In ₹'}>
            <Input type="number" min={0} leftSlot={<IndianRupee />} value={form.budget} onChange={(event) => setField('budget', event.target.value)} />
          </FormField>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-text">What the budget covers</span>
            <RadioGroup
              name="budget-scope"
              value={form.turnkey ? 'turnkey' : 'construction'}
              onChange={(value) => setField('turnkey', value === 'turnkey')}
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
              <SegmentedControl value={brief.kitchenType} onChange={(kitchenType) => setBrief({ kitchenType })} options={KITCHEN_OPTIONS} className="grid w-full grid-cols-2" />
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
                  <Checkbox checked={brief.extraRooms.includes(room.value)} onChange={() => wizard.toggleRoom(room.value)} />
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
            <SegmentedControl value={brief.familyType} onChange={(familyType) => setBrief({ familyType })} options={FAMILY_TYPE_OPTIONS} className="grid w-full grid-cols-2" />
            <p className="text-xs text-text-muted">Used to separate family spaces from guest areas.</p>
          </div>
          <label className="flex items-start gap-2.5 text-sm text-text">
            <Checkbox checked={brief.needsGroundFloorBedroom} onChange={(event) => setBrief({ needsGroundFloorBedroom: event.target.checked })} />
            <span>
              Needs a ground-floor bedroom
              <span className="block text-xs text-text-muted">For elderly or less-mobile family members</span>
            </span>
          </label>
        </>
      )}

      {step === STYLE_STEP && (
        <>
          <FormField label="House style" hint="You can change it any time; the 3D model and estimate follow it">
            <StyleChooser brief={brief} onChange={(patch) => setBrief(patch)} />
          </FormField>
          <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text">Follow Vastu guidelines</p>
              <p className="text-xs text-text-muted">Places the entrance, kitchen, bedrooms and staircase as per common Vastu practice</p>
            </div>
            <Switch checked={brief.vastu} onChange={(event) => setBrief({ vastu: event.target.checked })} />
          </div>
          <FormField label="Notes for the design team" hint="Optional">
            <Textarea value={form.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="e.g. We'd like a large verandah facing the garden." />
          </FormField>
        </>
      )}

      {step === REVIEW_STEP && (
        <>
          <ReviewSection title="Location" onEdit={() => goTo(LOCATION_STEP)}>
            <ReviewRow label="Address" value={form.site?.formattedAddress || (form.site ? `${form.site.lat.toFixed(5)}, ${form.site.lng.toFixed(5)}` : 'Not set')} />
            {form.site?.boundary && <ReviewRow label="Boundary" value={`Marked on the map (${form.site.boundary.length} corners)`} />}
          </ReviewSection>
          {form.site?.report && (
            <ReviewSection title="Site" onEdit={() => goTo(SITE_STEP)}>
              <ReviewRow
                label="Road"
                value={form.site.report.road ? `${form.site.report.road.name ?? 'Unnamed road'}${brief.roadWidthFt ? `, ${brief.roadWidthFt} ft wide` : ''}` : 'Not found on the map'}
              />
              <ReviewRow label="Earthquake zone" value={form.site.report.seismic_zone ? `Zone ${form.site.report.seismic_zone.value}` : 'Not available'} />
              <ReviewRow
                label="Soil"
                value={
                  form.site.details?.soilReport && form.site.details.sbcKnM2
                    ? `Tested: ${form.site.details.sbcKnM2} kN/m²`
                    : form.site.report.soil
                      ? `${form.site.report.soil.label.value} (indicative)`
                      : 'Not available'
                }
              />
            </ReviewSection>
          )}
          <ReviewSection title="Plot" onEdit={() => goTo(PLOT_STEP)}>
            <ReviewRow label="Project" value={form.name || '—'} />
            <ReviewRow label="Size" value={`${form.plotWidth}' × ${form.plotHeight}' · ${PLOT_SHAPE_OPTIONS.find((o) => o.value === brief.plotShape)?.label}`} />
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
  )
}
