import { Box, ChevronDown, ChevronLeft, ChevronRight, Download, FileStack, Layers, Minus, Plus, Printer } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { IconButton } from '@/components/ui/IconButton'
import { Tooltip } from '@/components/ui/Tooltip'
import { useElementSize } from '@/hooks/useElementSize'
import { cn } from '@/lib/cn'
import { type DisciplineId, type SheetDef, DISCIPLINES, buildDrawingSet, sheetRegister } from '@/lib/drawings/sheets'
import { useAuthStore } from '@/stores/useAuthStore'
import { useDesignStore } from '@/stores/useDesignStore'
import { useActiveProject } from '@/stores/useProjectsStore'
import { toast } from '@/stores/useToastStore'
import { ExportMenu } from './ExportMenu'
import { downloadSvg, downloadUrl, printSheets, sheetMarkup } from './exportSheets'
import { Model3DSheet, type ModelMode } from './Model3DSheet'
import { SHEET_COMPONENTS } from './renderSheet'

const PAPER_RATIO = 420 / 297
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4

function SheetBrowser({
  register,
  activeId,
  onSelect,
}: {
  register: SheetDef[]
  activeId: string
  onSelect: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<DisciplineId>>(new Set())
  const toggle = (id: DisciplineId) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <nav aria-label="Drawing sheets" className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <FileStack className="size-4 text-text-muted" />
        <span className="text-sm font-semibold text-text">Drawing set</span>
        <span className="ml-auto font-mono text-xs text-text-faint tabular-nums">{register.length} sheets</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {DISCIPLINES.map((discipline) => {
          const sheets = register.filter((s) => s.discipline === discipline.id)
          const open = !collapsed.has(discipline.id)
          return (
            <div key={discipline.id} className="px-2">
              <button
                type="button"
                onClick={() => toggle(discipline.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs font-semibold tracking-wide text-text-muted uppercase transition-colors hover:text-text"
              >
                <ChevronDown className={cn('size-3.5 transition-transform', !open && '-rotate-90')} />
                <span className="font-mono text-text-faint">{discipline.number}</span>
                {discipline.name}
              </button>
              {open && (
                <ul className="mb-1.5 ml-3 border-l border-border pl-2">
                  {sheets.map((sheet) => {
                    const active = sheet.id === activeId
                    return (
                      <li key={sheet.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(sheet.id)}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
                            active ? 'bg-primary-soft font-medium text-text' : 'text-text-muted hover:bg-surface-2 hover:text-text',
                          )}
                        >
                          <span className="w-12 shrink-0 font-mono text-[11px] text-text-faint">{sheet.code}</span>
                          <span className="min-w-0 flex-1 truncate">{sheet.title}</span>
                          {sheet.is3d && <Box className="size-3.5 shrink-0 text-text-faint" aria-label="3D model" />}
                          {sheet.perFloor && !sheet.is3d && <Layers className="size-3.5 shrink-0 text-text-faint" aria-label="Follows active floor" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </nav>
  )
}

export function DrawingsWorkspace() {
  const plot = useDesignStore((state) => state.plot)
  const floors = useDesignStore((state) => state.floors)
  const activeFloorId = useDesignStore((state) => state.activeFloorId)
  const activeSheetId = useDesignStore((state) => state.activeSheetId)
  const setActiveSheetId = useDesignStore((state) => state.setActiveSheetId)
  const project = useActiveProject()
  const userName = useAuthStore((state) => state.user?.name)

  const register = useMemo(() => sheetRegister(floors), [floors])
  const brief = project?.brief ?? null
  const budget = project?.budget
  const turnkey = project?.turnkey
  const set = useMemo(
    () =>
      buildDrawingSet(plot, floors, project?.name ?? 'Untitled project', userName ?? 'Griha', {
        brief,
        budget: budget !== undefined && turnkey !== undefined ? { amount: budget, turnkey } : null,
      }),
    [plot, floors, project?.name, userName, brief, budget, turnkey],
  )
  const index = Math.max(0, register.findIndex((s) => s.id === activeSheetId))
  const sheet = register[index]
  const floorName = floors.find((f) => f.id === (sheet.floorId ?? activeFloorId))?.name

  const [zoom, setZoom] = useState(1)
  const [viewerRef, viewerSize] = useElementSize<HTMLDivElement>()
  const paperRef = useRef<HTMLDivElement>(null)
  const pad = 48
  const fitWidth = Math.max(280, Math.min(viewerSize.width - pad, (viewerSize.height - pad) * PAPER_RATIO))
  const paperWidth = fitWidth * zoom

  const go = (delta: number) => {
    const next = register[(index + delta + register.length) % register.length]
    setActiveSheetId(next.id)
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && (target.closest('input, textarea, select, [contenteditable="true"]') || event.metaKey || event.ctrlKey || event.altKey)) return
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        setActiveSheetId(register[(index + 1) % register.length].id)
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        setActiveSheetId(register[(index - 1 + register.length) % register.length].id)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [index, register, setActiveSheetId])

  // Ctrl/⌘ + wheel zooms the paper; needs a non-passive listener to stop the browser zooming.
  const is3d = sheet.is3d
  useEffect(() => {
    const el = viewerRef.current
    if (!el || is3d) return
    function handleWheel(event: WheelEvent) {
      if (!(event.ctrlKey || event.metaKey)) return
      event.preventDefault()
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z * (event.deltaY < 0 ? 1.1 : 0.9)).toFixed(2))))
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [viewerRef, is3d])

  const fileBase = `${project?.name ?? 'project'} ${sheet.code} ${sheet.title}`

  function handleDownload() {
    if (sheet.is3d) {
      const canvas = paperRef.current?.querySelector('canvas')
      if (!canvas) return
      downloadUrl(canvas.toDataURL('image/png'), `${fileBase}.png`)
      return
    }
    const markup = sheetMarkup(set, sheet, activeFloorId)
    if (markup) downloadSvg(markup, `${fileBase}.svg`)
  }

  function handlePrintSheet() {
    const markup = sheetMarkup(set, sheet, activeFloorId)
    if (markup && !printSheets([{ markup }], fileBase)) toast.warning('Allow pop-ups to print drawings.')
  }

  const Sheet = SHEET_COMPONENTS[sheet.kind]
  const mode: ModelMode | null = sheet.kind === 'model-exterior' ? 'exterior' : sheet.kind === 'model-interior' ? 'interior' : sheet.kind === 'model-landscape' ? 'landscape' : null

  return (
    <div className="flex h-full min-h-0">
      <SheetBrowser register={register} activeId={sheet.id} onSelect={setActiveSheetId} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-surface px-4 py-2 sm:px-6">
          <select
            aria-label="Sheet"
            value={sheet.id}
            onChange={(event) => setActiveSheetId(event.target.value)}
            className="h-8 max-w-44 rounded-sm border border-border-strong bg-surface px-2 text-[13px] text-text md:hidden"
          >
            {DISCIPLINES.map((d) => (
              <optgroup key={d.id} label={`${d.number} ${d.name}`}>
                {register
                  .filter((s) => s.discipline === d.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} {s.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>

          <div className="hidden min-w-0 items-baseline gap-2 md:flex">
            <span className="font-mono text-xs text-text-faint">{sheet.code}</span>
            <h2 className="truncate text-sm font-semibold text-text">{sheet.title}</h2>
            {(sheet.perFloor || sheet.floorId) && floorName && (
              <span className="truncate text-xs text-text-muted">· {floorName}{sheet.perFloor && !sheet.floorId ? ' (switch floors above)' : ''}</span>
            )}
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-0.5 rounded-md bg-surface-2 p-1">
            <IconButton label="Previous sheet" size="sm" variant="ghost" onClick={() => go(-1)}>
              <ChevronLeft />
            </IconButton>
            <span className="min-w-12 text-center font-mono text-xs text-text-muted tabular-nums">
              {index + 1}/{register.length}
            </span>
            <IconButton label="Next sheet" size="sm" variant="ghost" onClick={() => go(1)}>
              <ChevronRight />
            </IconButton>
          </div>

          {!sheet.is3d && (
            <div className="flex items-center gap-0.5 rounded-md bg-surface-2 p-1">
              <IconButton label="Zoom out" size="sm" variant="ghost" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))}>
                <Minus />
              </IconButton>
              <button
                type="button"
                onClick={() => setZoom(1)}
                title="Fit to window"
                className="min-w-11 rounded-sm px-1.5 py-1 text-center font-mono text-xs text-text-muted tabular-nums transition-colors hover:text-text"
              >
                {Math.round(zoom * 100)}%
              </button>
              <IconButton label="Zoom in" size="sm" variant="ghost" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))}>
                <Plus />
              </IconButton>
            </div>
          )}

          <Tooltip content={sheet.is3d ? 'Download PNG' : 'Download SVG'} placement="bottom">
            <IconButton label={sheet.is3d ? 'Download PNG' : 'Download SVG'} size="sm" variant="outline" onClick={handleDownload}>
              <Download />
            </IconButton>
          </Tooltip>
          {!sheet.is3d && (
            <Tooltip content="Print / PDF this sheet" placement="bottom">
              <IconButton label="Print this sheet" size="sm" variant="outline" onClick={handlePrintSheet}>
                <Printer />
              </IconButton>
            </Tooltip>
          )}
          <ExportMenu set={set} register={register} sheet={sheet} floorId={activeFloorId} />
        </div>

        <div
          ref={viewerRef}
          className="relative min-h-0 flex-1 overflow-auto bg-surface-2"
        >
          {sheet.is3d && mode ? (
            <div ref={paperRef} className="absolute inset-0">
              <Model3DSheet key={`${sheet.id}-${activeFloorId}`} set={set} mode={mode} floorId={activeFloorId} />
              <div className="pointer-events-none absolute bottom-4 left-4 flex items-stretch overflow-hidden rounded-sm border border-[#1d1d1f] bg-white/90 text-[#1d1d1f] shadow-sm backdrop-blur-sm">
                <div className="bg-[#1d1d1f] px-3 py-2 font-mono text-lg font-bold text-white">{sheet.code}</div>
                <div className="px-3 py-1.5">
                  <div className="text-[10px] tracking-wider text-[#55555a] uppercase">{project?.name ?? 'Project'} · 3D model</div>
                  <div className="text-sm font-semibold">
                    {sheet.title}
                    {mode === 'interior' && floorName ? ` — ${floorName}` : ''}
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute top-3 right-4 rounded-sm bg-white/80 px-2 py-1 text-[11px] text-[#55555a]">
                Drag to orbit · scroll to zoom · right-drag to pan
              </div>
            </div>
          ) : (
            Sheet && (
              <div className="flex min-h-full min-w-full items-center justify-center p-6" style={{ width: paperWidth + pad }}>
                <div
                  ref={paperRef}
                  className="shrink-0 bg-white shadow-lg ring-1 ring-black/10 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                  style={{ width: paperWidth }}
                >
                  <Sheet set={set} sheet={sheet} floorId={activeFloorId} />
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
