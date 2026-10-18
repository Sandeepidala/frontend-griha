import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Box, Clapperboard, IndianRupee, LayoutDashboard, LinkIcon } from 'lucide-react'
import { SharedComments } from '@/components/share/SharedComments'
import { SharedPlan } from '@/components/share/SharedPlan'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Spinner } from '@/components/ui/Spinner'
import { Logo } from '@/components/widgets/Logo'
import { ApiError } from '@/lib/apiClient'
import { estimateBoq, formatLakhs } from '@/lib/boq'
import { describeBrief } from '@/lib/brief'
import { CATEGORY_LABELS, runDesignCheck, scoreVariant } from '@/lib/designCheck'
import { buildDrawingSet } from '@/lib/drawings/sheets'
import { type SharedProject as Shared, getSharedProject } from '@/lib/sharesApi'
import { lookFor } from '@/lib/style/kits'
import type { Plot } from '@/types/design'

// three.js loads only for the 3D view and the video, so the page opens quickly on a phone.
const Model3DSheet = lazy(() => import('@/components/drawings/Model3DSheet').then((m) => ({ default: m.Model3DSheet })))
const BuildSequenceDialog = lazy(() => import('@/components/canvas/BuildSequenceDialog').then((m) => ({ default: m.BuildSequenceDialog })))

type Tab = '3d' | 'plan' | 'cost'
const TABS = [
  { value: '3d' as const, label: '3D', icon: Box },
  { value: 'plan' as const, label: 'Plan', icon: LayoutDashboard },
  { value: 'cost' as const, label: 'Cost', icon: IndianRupee },
]

/** Keeps search engines away from shared designs, and names the tab after the project. */
function usePrivatePage(title: string | null) {
  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => meta.remove()
  }, [])
  useEffect(() => {
    if (!title) return
    const before = document.title
    document.title = `${title} · shared on Griha`
    return () => {
      document.title = before
    }
  }, [title])
}

/** A project as a view-only link shows it to family or a contractor: no account, nothing to edit. */
export function SharedProject() {
  const { token = '' } = useParams()
  const [state, setState] = useState<{ token: string; shared: Shared | null; error: string | null } | null>(null)
  const current = state?.token === token ? state : null
  usePrivatePage(current?.shared?.project.name ?? null)

  useEffect(() => {
    let cancelled = false
    getSharedProject(token)
      .then((shared) => !cancelled && setState({ token, shared, error: null }))
      .catch((err) => !cancelled && setState({ token, shared: null, error: err instanceof ApiError && err.status === 404 ? 'gone' : 'offline' }))
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between gap-3 px-4">
          <Logo />
          {current?.shared && (
            <span className="truncate text-xs text-text-muted">
              Shared by <span className="font-medium text-text">{current.shared.ownerFirstName}</span> · view only
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-5">
        {!current ? (
          <div className="flex justify-center py-24">
            <Spinner size="lg" />
          </div>
        ) : current.shared ? (
          <SharedView token={token} shared={current.shared} />
        ) : (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <LinkIcon className="size-8 text-text-faint" />
            <h1 className="font-display text-xl font-semibold text-text">{current.error === 'gone' ? 'This link has been turned off' : "Couldn't open this design"}</h1>
            <p className="max-w-sm text-sm text-text-muted">
              {current.error === 'gone'
                ? 'The person who shared it may have turned it off, or the link is incomplete. Ask them for a new one.'
                : 'Check your connection and try again.'}
            </p>
          </div>
        )}
        <footer className="border-t border-border pt-5 pb-8 text-center text-xs text-text-muted">
          Designs on Griha are concepts for planning, not approved building plans.{' '}
          <Link to="/sign-up" className="font-medium text-primary hover:underline">
            Plan your own home with Griha
          </Link>
        </footer>
      </main>
    </div>
  )
}

function SharedView({ token, shared }: { token: string; shared: Shared }) {
  const { project, ownerFirstName, allowComments } = shared
  const [tab, setTab] = useState<Tab>('3d')
  const [video, setVideo] = useState(false)
  const plot: Plot = useMemo(
    () => ({ width: project.plotWidth, height: project.plotHeight, facing: project.facing, units: project.units, setbacks: project.setbacks }),
    [project],
  )
  const budget = useMemo(() => ({ amount: project.budget, turnkey: project.turnkey }), [project])
  const set = useMemo(
    () => buildDrawingSet(plot, project.floors, project.name, ownerFirstName, { brief: project.brief, budget, site: project.site }),
    [plot, project, ownerFirstName, budget],
  )
  const estimate = useMemo(() => estimateBoq({ plot, floors: project.floors, brief: project.brief, budget, site: project.site }), [plot, project, budget])
  const report = useMemo(
    () =>
      runDesignCheck({
        plot,
        floors: project.floors,
        brief: project.brief,
        cost: estimate.budget ? { estimate: estimate.total, budget: estimate.budget.amount, turnkey: estimate.includeInteriors } : null,
        site: project.site,
      }),
    [plot, project, estimate],
  )
  const look = lookFor(project.brief)
  const storeys = set.models.filter((m) => m.rooms.length > 0).length
  const hasPlan = storeys > 0

  return (
    <>
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold text-text">{project.name}</h1>
        <p className="text-sm text-text-muted">
          {describeBrief(project.brief)} · {project.plotWidth}' × {project.plotHeight}' plot ·{' '}
          {project.facing[0].toUpperCase() + project.facing.slice(1)}-facing
        </p>
        {hasPlan && (
          <div className="flex flex-wrap gap-2">
            <Badge variant={scoreVariant(report.score)} className="font-mono tabular-nums">
              Design score {report.score}
            </Badge>
            <Badge variant="neutral" className="font-mono tabular-nums">
              Estimate {formatLakhs(estimate.total)}
            </Badge>
            <Badge variant="neutral">
              {look.kit.name} · {look.palette.name}
            </Badge>
          </div>
        )}
      </section>

      {hasPlan ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl value={tab} onChange={setTab} options={TABS} />
            <Button size="sm" variant="outline" onClick={() => setVideo(true)}>
              <Clapperboard className="size-4" /> Watch it get built
            </Button>
          </div>

          {tab === '3d' && (
            <div className="relative h-[62vh] min-h-80 overflow-hidden rounded-md border border-border">
              <Suspense fallback={<div className="flex h-full items-center justify-center"><Spinner size="lg" /></div>}>
                <Model3DSheet set={set} mode="exterior" floorId={set.models[0]?.floor.id ?? ''} />
              </Suspense>
              <span className="pointer-events-none absolute bottom-2 left-2 rounded-sm bg-surface/90 px-2 py-1 text-[11px] text-text-muted">
                Drag to turn · pinch or scroll to zoom
              </span>
            </div>
          )}
          {tab === 'plan' && <SharedPlan models={set.models} units={plot.units} />}
          {tab === 'cost' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-text-muted">Estimated cost</p>
                  <p className="font-display text-xl font-bold text-text tabular-nums">{formatLakhs(estimate.total)}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-text-muted">Built-up area</p>
                  <p className="font-display text-xl font-bold text-text tabular-nums">{estimate.builtUpArea.toLocaleString('en-IN')} sq ft</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-xs text-text-muted">Per sq ft</p>
                  <p className="font-display text-xl font-bold text-text tabular-nums">₹{estimate.costPerSqft.toLocaleString('en-IN')}</p>
                </div>
              </div>
              <ul className="divide-y divide-border rounded-md border border-border">
                {estimate.sections
                  .filter((s) => s.kind === 'building')
                  .map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="text-text">{s.title}</span>
                      <span className="font-mono text-xs text-text-muted tabular-nums">{formatLakhs(s.subtotal)}</span>
                    </li>
                  ))}
                <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span className="text-text">Rooms: finishes, doors, windows and fittings</span>
                  <span className="font-mono text-xs text-text-muted tabular-nums">
                    {formatLakhs(estimate.sections.filter((s) => s.kind === 'room').reduce((sum, s) => sum + s.subtotal, 0))}
                  </span>
                </li>
                {estimate.overheads.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-text-muted">{o.label}</span>
                    <span className="font-mono text-xs text-text-muted tabular-nums">{formatLakhs(o.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 rounded-md border border-border p-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-sm font-medium text-text">Design check</p>
                  <span className="font-mono text-sm text-text tabular-nums">{report.score}/100</span>
                </div>
                <ProgressBar value={report.score} variant={scoreVariant(report.score)} />
                <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-muted">
                  {report.categories.map((c) => (
                    <li key={c.category} className="flex justify-between">
                      <span>{CATEGORY_LABELS[c.category]}</span>
                      <span className="font-mono tabular-nums">{c.score ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="text-xs text-text-faint">{estimate.ratesAsOf}. An estimate for planning, not a quotation.</p>
            </div>
          )}
        </section>
      ) : (
        <p className="py-10 text-center text-sm text-text-muted">{ownerFirstName} hasn't drawn a plan for this project yet.</p>
      )}

      <SharedComments token={token} allowComments={allowComments} ownerFirstName={ownerFirstName} />

      {video && (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><Spinner size="lg" /></div>}>
          <BuildSequenceDialog
            onClose={() => setVideo(false)}
            title={project.name}
            projectName={project.name}
            plot={plot}
            floors={project.floors}
            brief={project.brief}
            estimate={estimate}
          />
        </Suspense>
      )}
    </>
  )
}
