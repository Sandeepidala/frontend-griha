import type { Rect } from '@/lib/drawings/geometry'

/**
 * Where a 3D view should look: the middle of the house and how big it is, so the camera frames the
 * house whatever the plot size (a small house on a large plot would otherwise be a speck at the
 * edge). Three.js coordinates, with the plot centred on the origin.
 */
export interface HouseFrame {
  /** Middle of the house on the ground: plan x → three.js x, plan y → three.js z. */
  center: { x: number; z: number }
  /** Largest horizontal extent of the house, ft; never under 16 so tiny plans aren't over-zoomed. */
  size: number
}

const MIN_SIZE = 16

export function houseFrame(plot: { width: number; height: number }, rects: Rect[]): HouseFrame {
  if (rects.length === 0) return { center: { x: 0, z: 0 }, size: Math.max(MIN_SIZE, plot.width, plot.height) }
  const x0 = Math.min(...rects.map((r) => r.x))
  const y0 = Math.min(...rects.map((r) => r.y))
  const x1 = Math.max(...rects.map((r) => r.x + r.width))
  const y1 = Math.max(...rects.map((r) => r.y + r.height))
  return {
    center: { x: (x0 + x1) / 2 - plot.width / 2, z: (y0 + y1) / 2 - plot.height / 2 },
    size: Math.max(MIN_SIZE, x1 - x0, y1 - y0),
  }
}
