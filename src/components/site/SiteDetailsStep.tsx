import { AlertTriangle, CloudRain, Compass, Droplets, Layers, MapPin, Mountain, RefreshCw, Route, Zap } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Switch } from '@/components/ui/Switch'
import { ApiError } from '@/lib/apiError'
import { fetchSiteReport } from '@/lib/geo/api'
import { cn } from '@/lib/cn'
import { ASSUMED_SBC_KN_M2 } from '@/lib/site'
import type { ProjectBrief } from '@/types/brief'
import type { SiteLocation } from '@/types/project'
import { CONSTRAINT_ALERT_M, CONSTRAINT_LABELS, EMPTY_SITE_DETAILS, type Fact, type FactConfidence, type SiteDetails } from '@/types/site'

const M_PER_FT = 0.3048

const BADGES: Record<FactConfidence, { label: string; variant: 'success' | 'primary' | 'warning' | 'neutral' }> = {
  measured: { label: 'Measured on map', variant: 'success' },
  official: { label: 'Code table', variant: 'primary' },
  estimated: { label: 'Estimated', variant: 'warning' },
  indicative: { label: 'Indicative', variant: 'warning' },
  entered: { label: 'Entered by you', variant: 'neutral' },
}

function ConfidenceBadge({ confidence }: { confidence: FactConfidence }) {
  const { label, variant } = BADGES[confidence]
  return (
    <Badge variant={variant} className="shrink-0">
      {label}
    </Badge>
  )
}

function Row({ label, value, confidence, note, children }: { label: string; value?: ReactNode; confidence?: FactConfidence; note?: string | null; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        {confidence && <ConfidenceBadge confidence={confidence} />}
      </div>
      <div className="text-sm font-medium text-text">{children ?? value ?? '—'}</div>
      {note && <p className="text-xs text-text-faint">{note}</p>}
    </div>
  )
}

function factText(fact: Fact | null | undefined) {
  if (!fact || fact.value === null) return null
  return `${typeof fact.value === 'number' ? fact.value.toLocaleString('en-IN') : String(fact.value)}${fact.unit ? ` ${fact.unit}` : ''}`
}

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border">
      <h3 className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-semibold text-text [&>svg]:size-4 [&>svg]:text-text-muted">
        {icon}
        {title}
      </h3>
      <div className="divide-y divide-border px-4">{children}</div>
    </section>
  )
}

interface SiteDetailsStepProps {
  site: SiteLocation | null
  onChange: (site: SiteLocation) => void
  brief: ProjectBrief
  setBrief: (patch: Partial<ProjectBrief>) => void
  /** Switches the plot's road side (re-measures facing and rotation). */
  onUseRoadEdge: (edge: number) => void
  onGoToLocation: () => void
}

/**
 * Site details: what the map and open data say about the marked plot (road, ground, design zones,
 * soil, nearby constraints), each value with its source. The customer confirms or corrects anything;
 * the values then feed the bye-laws, design check, cost estimate and the drawing set's Site report.
 */
export function SiteDetailsStep({ site, onChange, brief, setBrief, onUseRoadEdge, onGoToLocation }: SiteDetailsStepProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const details = site?.details ?? EMPTY_SITE_DETAILS
  const report = site?.report ?? null
  // The newest site, for the request that's in flight.
  const live = useRef({ site, onChange, brief, setBrief })
  live.current = { site, onChange, brief, setBrief }

  function setDetails(patch: Partial<SiteDetails>) {
    if (site) onChange({ ...site, details: { ...details, ...patch } })
  }

  async function load() {
    const current = live.current.site
    if (!current) return
    setLoading(true)
    setError(null)
    try {
      const fresh = await fetchSiteReport({
        lat: current.lat,
        lng: current.lng,
        boundary: current.boundary,
        roadEdge: current.roadEdge,
        city: current.city,
        state: current.state,
        countryCode: current.countryCode,
      })
      const latest = live.current.site ?? current
      live.current.onChange({ ...latest, report: fresh })
      // Fill what the brief hasn't been told yet: road width (measured, else the estimate) and a corner plot.
      const b = live.current.brief
      const measured = latest.details?.roadWidthMeasured ? latest.details.roadWidthM : null
      const width = measured ?? (typeof fresh.road?.width.value === 'number' ? fresh.road.width.value : null)
      const patch: Partial<ProjectBrief> = {}
      if (width && (b.roadWidthFt === null || measured)) patch.roadWidthFt = Math.round(width / M_PER_FT)
      if (fresh.corner_plot?.value === true && !b.cornerPlot) patch.cornerPlot = true
      if (Object.keys(patch).length) live.current.setBrief(patch)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't read the site. Check the connection and try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (site && !site.report) void load()
    // Fetch once per site position; a new pin or boundary clears the report and fetches again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site?.lat, site?.lng, site?.roadEdge, site?.boundary?.length, Boolean(site?.report)])

  if (!site) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border p-5">
        <p className="text-sm text-text-muted">
          Add the plot's location first: the road, ground, design zones and soil are read from the map. You can also skip this and
          enter the plot by hand.
        </p>
        <Button size="sm" variant="outline" leftIcon={<MapPin className="size-4" />} onClick={onGoToLocation}>
          Add the location
        </Button>
      </div>
    )
  }

  const road = report?.road
  const widthFt = details.roadWidthM ? Math.round(details.roadWidthM / M_PER_FT) : brief.roadWidthFt
  const soil = report?.soil
  const alerts = (report?.constraints ?? []).filter((c) => c.distance_m <= CONSTRAINT_ALERT_M[c.kind])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">
        Read from the map and open data. Check each value: badges show where it came from. Values marked{' '}
        <span className="font-medium text-warning">Estimated</span> or <span className="font-medium text-warning">Indicative</span> should
        be confirmed on site.
      </p>

      {loading && (
        <div className="flex flex-col gap-2" aria-busy="true">
          <p className="text-sm text-text-muted">Reading the site: roads, ground, design zones and soil… (up to half a minute)</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-2" />
          ))}
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm">
          <span className="text-text">{error}</span>
          <Button size="sm" variant="outline" leftIcon={<RefreshCw className="size-4" />} onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      {report && !loading && (
        <>
          {report.unavailable.length > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm">
              <span className="text-text-muted">Not available right now: {report.unavailable.join('; ')}.</span>
              <Button size="sm" variant="ghost" leftIcon={<RefreshCw className="size-4" />} onClick={() => void load()}>
                Try again
              </Button>
            </div>
          )}

          {report.suggested_road_edge !== null && (
            <div className="flex flex-col gap-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm">
              <p className="text-text">
                <AlertTriangle className="mr-1 inline size-4 text-warning" />
                A public road runs along a different side of the plot than the one you marked as the road side. Facing and setbacks
                depend on it.
              </p>
              <Button size="sm" variant="outline" className="self-start" onClick={() => onUseRoadEdge(report.suggested_road_edge!)}>
                Use that side as the road side
              </Button>
            </div>
          )}

          <Section icon={<Route />} title="Road">
            <Row label="Road in front" value={road ? `${road.name ?? 'Unnamed road'} · ${road.kind.replace('_', ' ')}` : 'No mapped road found nearby'} confidence={road ? 'estimated' : undefined} note={road ? `${road.centreline_distance_m} m from the middle of your road side to the road's centre.` : null} />
            <Row
              label="Road width"
              confidence={details.roadWidthMeasured ? (details.roadWidthM ? 'measured' : 'entered') : road ? 'estimated' : undefined}
              note={
                details.roadWidthMeasured
                  ? 'Sets the floor-area and height limits. Correct it from your layout plan if it differs.'
                  : (road?.width.note ?? 'Enter it from your layout plan or measure it on the map (Location step).')
              }
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="w-28"
                  aria-label="Road width in feet"
                  value={widthFt ?? ''}
                  onChange={(e) => {
                    const ft = Number(e.target.value)
                    setBrief({ roadWidthFt: ft > 0 ? ft : null })
                    setDetails({ roadWidthM: ft > 0 ? Math.round(ft * M_PER_FT * 10) / 10 : null, roadWidthMeasured: ft > 0 })
                  }}
                />
                <span className="text-sm whitespace-nowrap text-text-muted">ft{widthFt ? ` (${(widthFt * M_PER_FT).toFixed(1)} m)` : ''}</span>
              </div>
            </Row>
            <Row label="Corner plot" confidence={report.corner_plot ? 'estimated' : undefined} note={report.corner_plot?.note}>
              <Switch checked={brief.cornerPlot} onChange={(e) => setBrief({ cornerPlot: e.target.checked })} aria-label="Corner plot" />
            </Row>
            <Row label="Plot level vs road" note="Below the road, the plinth must be raised (usually ≥ road + 450 mm) and rainwater drained away from the house.">
              <SegmentedControl<'above' | 'level' | 'below'>
                value={details.roadLevel ?? 'level'}
                onChange={(roadLevel) => setDetails({ roadLevel })}
                options={[
                  { value: 'above', label: 'Above' },
                  { value: 'level', label: 'Level' },
                  { value: 'below', label: 'Below' },
                ]}
              />
            </Row>
          </Section>

          <Section icon={<Mountain />} title="Ground and climate">
            <Row label="Ground level" value={factText(report.elevation)} confidence={report.elevation?.confidence} note={report.elevation?.note} />
            <Row label="Fall of the land" value={factText(report.slope)} confidence={report.slope?.confidence} note={report.slope?.note} />
            <Row label="Rainfall" value={factText(report.annual_rainfall)} confidence={report.annual_rainfall?.confidence} note="Sizes roof drains and the rainwater-harvesting pit or tank." />
          </Section>

          <Section icon={<Compass />} title="Design zones">
            <Row label="Earthquake zone" value={report.seismic_zone ? `Zone ${report.seismic_zone.value}` : null} confidence={report.seismic_zone?.confidence} note={report.seismic_zone ? `${report.seismic_zone.source}. ${report.seismic_zone.note ?? ''}` : 'Your structural engineer confirms the zone.'} />
            <Row label="Basic wind speed" value={factText(report.wind_speed)} confidence={report.wind_speed?.confidence} note={report.wind_speed?.source} />
          </Section>

          <Section icon={<Layers />} title="Soil">
            <Row label="Likely soil" value={soil ? String(soil.label.value) : null} confidence={soil?.label.confidence} note={soil?.label.note} />
            {soil?.sbc_range_kn_m2 && (
              <Row label="Typical bearing" value={`${soil.sbc_range_kn_m2[0]}–${soil.sbc_range_kn_m2[1]} kN/m²`} confidence="indicative" note="For orientation only, never for design." />
            )}
            {soil && (
              <div className={cn('my-2.5 rounded-md px-3 py-2 text-xs', soil.expansive ? 'bg-warning-soft text-text' : 'bg-surface-2 text-text-muted')}>
                {soil.expansive && <span className="font-semibold">Swelling soil likely. </span>}
                {soil.advice}
              </div>
            )}
            <Row label="Soil test report" note={details.soilReport ? 'These values replace the estimates in the design check, cost estimate and drawings.' : `Until you add one, foundations assume a safe bearing capacity of ${ASSUMED_SBC_KN_M2} kN/m², which may cost more than needed.`}>
              <Switch checked={details.soilReport} onChange={(e) => setDetails({ soilReport: e.target.checked })} aria-label="I have a soil test report" />
            </Row>
            {details.soilReport && (
              <>
                <Row label="Safe bearing capacity" confidence="entered">
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} className="w-28" aria-label="Safe bearing capacity" value={details.sbcKnM2 ?? ''} onChange={(e) => setDetails({ sbcKnM2: Number(e.target.value) > 0 ? Number(e.target.value) : null })} />
                    <span className="text-sm whitespace-nowrap text-text-muted">kN/m²</span>
                  </div>
                </Row>
                <Row label="Soil type (report)" confidence="entered">
                  <Input value={details.soilType ?? ''} aria-label="Soil type from the report" placeholder="e.g. Silty sand with gravel" onChange={(e) => setDetails({ soilType: e.target.value || null })} />
                </Row>
                <Row label="Groundwater depth" confidence="entered">
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} className="w-28" aria-label="Groundwater depth" value={details.groundwaterDepthM ?? ''} onChange={(e) => setDetails({ groundwaterDepthM: e.target.value === '' ? null : Number(e.target.value) })} />
                    <span className="text-sm whitespace-nowrap text-text-muted">m deep</span>
                  </div>
                </Row>
              </>
            )}
          </Section>

          <Section icon={<Droplets />} title="Nearby">
            {report.constraints.length === 0 ? (
              <p className="py-2.5 text-sm text-text-muted">No mapped lakes, drains, power lines or railways within 250 m.</p>
            ) : (
              report.constraints.map((c) => (
                <Row
                  key={c.kind}
                  label={CONSTRAINT_LABELS[c.kind]}
                  value={`${c.name ? `${c.name}, ` : ''}${c.distance_m} m away${c.detail ? ` (${c.detail})` : ''}`}
                  confidence="estimated"
                  note={alerts.includes(c) ? c.note : null}
                />
              ))
            )}
          </Section>

          <Section icon={<Zap />} title="Services at the plot">
            <Row label="Municipal water">
              <Switch checked={details.waterSupply ?? true} onChange={(e) => setDetails({ waterSupply: e.target.checked })} aria-label="Municipal water supply" />
            </Row>
            <Row label="Underground drainage" note={details.sewer === false ? 'Without a sewer, the plan needs a septic tank and soak pit.' : null}>
              <Switch checked={details.sewer ?? true} onChange={(e) => setDetails({ sewer: e.target.checked })} aria-label="Underground drainage (sewer)" />
            </Row>
            <Row label="Electricity">
              <Switch checked={details.electricity ?? true} onChange={(e) => setDetails({ electricity: e.target.checked })} aria-label="Electricity connection" />
            </Row>
          </Section>

          <p className="flex items-start gap-1.5 text-[11px] text-text-faint">
            <CloudRain className="mt-px size-3.5 shrink-0" />
            Sources: OpenStreetMap (roads, nearby features), Copernicus DEM and ERA5 via Open-Meteo (ground, rainfall), IS 1893 and IS 875
            (zones), NBSS&LUP soil regions. Map data can be incomplete; nothing here replaces a site survey or soil investigation.
          </p>
        </>
      )}
    </div>
  )
}
