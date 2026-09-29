import { ChevronDown, Download, DraftingCompass, FileStack, FileText, Printer } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Popover } from '@/components/ui/Popover'
import type { DrawingSet, SheetDef } from '@/lib/drawings/sheets'
import { buildDxf, dxfUnitsLabel } from '@/lib/export/dxf'
import { sheetsToPdf } from '@/lib/export/pdf'
import { toast } from '@/stores/useToastStore'
import { downloadBlob, fullSetMarkup, printSheets, sheetMarkup } from './exportSheets'

interface ExportMenuProps {
  set: DrawingSet
  register: SheetDef[]
  /** The sheet on screen, for single-sheet PDFs; 3D sheets have none. */
  sheet: SheetDef
  floorId: string
}

function MenuItem({ icon, title, detail, onClick, disabled }: { icon: ReactNode; title: string; detail: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-start gap-2.5 rounded-sm px-2.5 py-2 text-left transition-colors hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-text-muted"
    >
      {icon}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-text">{title}</span>
        <span className="block text-xs text-text-muted">{detail}</span>
      </span>
    </button>
  )
}

/** Handover files for the contractor and site engineer: PDF drawing sets and DXF plans for CAD. */
export function ExportMenu({ set, register, sheet, floorId }: ExportMenuProps) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const name = set.projectName || 'Project'
  const hasRooms = set.models.some((m) => m.rooms.length > 0)
  // Matches fullSetMarkup: 2D sheets, the per-floor ones once per floor.
  const sheetCount = register.filter((s) => !s.is3d).reduce((n, s) => n + (s.perFloor && set.models.length > 1 ? set.models.length : 1), 0)

  async function exportPdf(pages: { code: string; markup: string }[], filename: string, subject: string) {
    setProgress({ done: 0, total: pages.length })
    try {
      const blob = await sheetsToPdf(pages, { title: `${name} — ${subject}`, author: set.author, subject }, (done, total) => setProgress({ done, total }))
      downloadBlob(blob, 'application/pdf', filename)
      toast.success(pages.length > 1 ? `Downloaded the ${pages.length}-sheet drawing set as PDF.` : `Downloaded ${pages[0].code} as PDF.`)
    } catch (error) {
      console.error(error)
      toast.danger('Could not create the PDF. Try Print → Save as PDF instead.')
    } finally {
      setProgress(null)
    }
  }

  function handleSetPdf() {
    void exportPdf(fullSetMarkup(set, register), `${name} drawing set.pdf`, 'Drawing set')
  }

  function handleSheetPdf() {
    const markup = sheetMarkup(set, sheet, floorId)
    if (markup) void exportPdf([{ code: sheet.code, markup }], `${name} ${sheet.code} ${sheet.title}.pdf`, `${sheet.code} ${sheet.title}`)
  }

  function handleDxf() {
    const dxf = buildDxf(set)
    if (dxf.floors === 0) {
      toast.warning('Add rooms to the plan before exporting to CAD.')
      return
    }
    downloadBlob(dxf.content, 'application/dxf', `${name} floor plans.dxf`)
    toast.success(`Downloaded ${dxf.floors} floor plan${dxf.floors === 1 ? '' : 's'} as DXF, drawn in ${dxfUnitsLabel(dxf.units)}.`)
  }

  function handlePrint() {
    const pages = fullSetMarkup(set, register)
    if (!printSheets(pages, `${name} — Drawing set`)) toast.warning('Allow pop-ups to print drawings.')
  }

  if (progress) {
    return (
      <Button size="sm" variant="primary" isLoading>
        PDF {progress.done}/{progress.total}
      </Button>
    )
  }

  return (
    <Popover
      panelClassName="w-72 p-1"
      trigger={
        <Button size="sm" variant="primary" leftIcon={<Download className="size-4" />} rightIcon={<ChevronDown className="size-3.5" />}>
          Export
        </Button>
      }
    >
      {(close) => {
        const run = (action: () => void) => () => {
          close()
          action()
        }
        return (
          <div className="flex flex-col">
            <MenuItem icon={<FileStack />} title="Drawing set (PDF)" detail={`All ${sheetCount} sheets on A3, with the summary and cost sheets`} onClick={run(handleSetPdf)} disabled={!hasRooms} />
            <MenuItem
              icon={<FileText />}
              title="This sheet (PDF)"
              detail={sheet.is3d ? 'Not available for 3D views' : `${sheet.code} ${sheet.title}`}
              onClick={run(handleSheetPdf)}
              disabled={sheet.is3d}
            />
            <MenuItem icon={<DraftingCompass />} title="Floor plans (DXF)" detail="For AutoCAD and other CAD: walls, doors, windows, dimensions on layers" onClick={run(handleDxf)} disabled={!hasRooms} />
            <div className="my-1 border-t border-border" />
            <MenuItem icon={<Printer />} title="Print drawing set" detail="Opens the browser's print dialog" onClick={run(handlePrint)} />
          </div>
        )
      }}
    </Popover>
  )
}
