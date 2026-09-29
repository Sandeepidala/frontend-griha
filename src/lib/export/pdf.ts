/**
 * PDF export of drawing sheets (project document §7, §9.2): each sheet's SVG drawn as vector
 * graphics onto an A3-landscape page, so lines stay sharp at any zoom and text stays selectable.
 * jsPDF and svg2pdf load on first use, keeping them out of the main bundle.
 */

export interface PdfPage {
  code: string
  markup: string
}

export interface PdfInfo {
  title: string
  author: string
  subject?: string
}

const PAGE: [number, number] = [420, 297]

/**
 * PDF's built-in fonts cover Latin-1 only; swap the characters the sheets use beyond it
 * (the rupee sign, ≤, ≥, arrows, typographic dashes and quotes) for plain equivalents.
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/₹\s?/g, 'Rs '],
  [/≤/g, '<='],
  [/≥/g, '>='],
  [/→/g, '->'],
  [/[−–—]/g, '-'],
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
  [/…/g, '...'],
  [/•/g, '·'],
]

export function pdfSafeText(text: string) {
  let out = text
  for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement)
  return out.replace(/[^\x20-\x7e\xa0-\xff\n]/g, '?')
}

/** Makes a sheet drawable with PDF's built-in fonts: Latin-1 text, and only normal or bold weights. */
function prepare(root: Element) {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeValue) node.nodeValue = pdfSafeText(node.nodeValue)
  }
  // Helvetica comes in normal and bold only; other weights would fall back to Times.
  for (const el of root.querySelectorAll('[font-weight]')) {
    const weight = el.getAttribute('font-weight') ?? ''
    el.setAttribute('font-weight', weight === 'bold' || Number(weight) >= 600 ? 'bold' : 'normal')
  }
}

/** Renders the sheets into one PDF, one A3 page each. `onProgress` reports pages done. */
export async function sheetsToPdf(pages: PdfPage[], info: PdfInfo, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')])
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: PAGE, compress: true })
  // svg2pdf reads computed styles, so each sheet is mounted off-screen while it's drawn.
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-20000px;top:0;width:420mm;height:297mm;overflow:hidden;pointer-events:none'
  document.body.appendChild(host)
  try {
    for (const [i, page] of pages.entries()) {
      if (i > 0) doc.addPage(PAGE, 'landscape')
      host.innerHTML = page.markup
      const svg = host.querySelector('svg')
      if (!svg) continue
      prepare(svg)
      await svg2pdf(svg, doc, { x: 0, y: 0, width: PAGE[0], height: PAGE[1] })
      onProgress?.(i + 1, pages.length)
      // Let the page repaint between sheets on long sets.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  } finally {
    host.remove()
  }
  doc.setProperties({ title: pdfSafeText(info.title), author: pdfSafeText(info.author), subject: pdfSafeText(info.subject ?? ''), creator: 'Griha' })
  return doc.output('blob')
}
