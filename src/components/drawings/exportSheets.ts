import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { DrawingSet, SheetDef } from '@/lib/drawings/sheets'
import { SHEET_COMPONENTS } from './renderSheet'

/** Renders a 2D sheet to standalone SVG markup (sheets are pure functions of the drawing set). */
export function sheetMarkup(set: DrawingSet, sheet: SheetDef, floorId: string): string | null {
  const Component = SHEET_COMPONENTS[sheet.kind]
  if (!Component) return null
  return renderToStaticMarkup(createElement(Component, { set, sheet, floorId }))
}

/**
 * Every printable sheet in register order. Sheets that follow the active floor are issued once
 * per floor with a letter suffix (E-101A, E-101B…).
 */
export function fullSetMarkup(set: DrawingSet, register: SheetDef[]) {
  const pages: { code: string; markup: string }[] = []
  for (const sheet of register) {
    if (sheet.is3d) continue
    if (sheet.perFloor && set.models.length > 1) {
      set.models.forEach((m, i) => {
        const code = `${sheet.code}${String.fromCharCode(65 + i)}`
        const markup = sheetMarkup(set, { ...sheet, code }, m.floor.id)
        if (markup) pages.push({ code, markup })
      })
    } else {
      const markup = sheetMarkup(set, sheet, set.models[0]?.floor.id ?? '')
      if (markup) pages.push({ code: sheet.code, markup })
    }
  }
  return pages
}

function slug(text: string) {
  return text.replace(/[^\w.-]+/g, '_')
}

export function downloadBlob(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  downloadUrl(url, filename)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadUrl(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = slug(filename)
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export function downloadSvg(markup: string, filename: string) {
  downloadBlob(`<?xml version="1.0" encoding="UTF-8"?>\n${markup}`, 'image/svg+xml', filename)
}

/** Opens the sheets in a print window sized for A3 landscape — "Save as PDF" gives a drawing set. */
export function printSheets(pages: { markup: string }[], title: string) {
  const win = window.open('', '_blank')
  if (!win) return false
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '')}</title>
<style>
@page { size: 420mm 297mm; margin: 0; }
html, body { margin: 0; padding: 0; background: #888; }
.page { width: 420mm; height: 297mm; overflow: hidden; break-after: page; page-break-after: always; background: #fff; margin: 0 auto 8mm; }
.page:last-child { break-after: auto; page-break-after: auto; }
.page svg { display: block; width: 420mm; height: 297mm; }
@media print { html, body { background: #fff; } .page { margin: 0; } }
</style></head><body>${pages.map((p) => `<div class="page">${p.markup}</div>`).join('')}</body></html>`
  win.document.open()
  win.document.write(html)
  win.document.close()
  setTimeout(() => {
    win.focus()
    win.print()
  }, 400)
  return true
}
