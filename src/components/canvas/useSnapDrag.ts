import type Konva from 'konva'
import { useEffect, useRef, useState } from 'react'
import type { Guides, PlacedRect, Plot } from '@/types/design'

const SNAP_PX = 6

interface SnapResult {
  x: number
  y: number
  snapX: number | null
  snapY: number | null
}

function nearestTarget(value: number, targets: number[], tolerance: number): number | null {
  let best: number | null = null
  let bestDelta = tolerance
  for (const target of targets) {
    const delta = Math.abs(value - target)
    if (delta <= bestDelta) {
      bestDelta = delta
      best = target
    }
  }
  return best
}

function computeSnap(
  element: PlacedRect,
  candidateX: number,
  candidateY: number,
  elements: PlacedRect[],
  plot: Plot,
  guides: Guides,
  scale: number,
): SnapResult {
  const tolerance = SNAP_PX / scale
  const verticalTargets = [0, plot.width, ...guides.vertical]
  const horizontalTargets = [0, plot.height, ...guides.horizontal]
  for (const other of elements) {
    if (other.id === element.id) continue
    verticalTargets.push(other.x, other.x + other.width)
    horizontalTargets.push(other.y, other.y + other.height)
  }

  let x = candidateX
  let snapX: number | null = null
  const leftSnap = nearestTarget(candidateX, verticalTargets, tolerance)
  const rightSnap = nearestTarget(candidateX + element.width, verticalTargets, tolerance)
  if (leftSnap !== null) {
    x = leftSnap
    snapX = leftSnap
  } else if (rightSnap !== null) {
    x = rightSnap - element.width
    snapX = rightSnap
  }

  let y = candidateY
  let snapY: number | null = null
  const topSnap = nearestTarget(candidateY, horizontalTargets, tolerance)
  const bottomSnap = nearestTarget(candidateY + element.height, horizontalTargets, tolerance)
  if (topSnap !== null) {
    y = topSnap
    snapY = topSnap
  } else if (bottomSnap !== null) {
    y = bottomSnap - element.height
    snapY = bottomSnap
  }

  return { x, y, snapX, snapY }
}

export interface UseSnapDragOptions<T extends PlacedRect> {
  elements: T[]
  selectedId: string | null
  plot: Plot
  guides: Guides
  scale: number
  onMove: (id: string, x: number, y: number) => void
  onTransform: (id: string, patch: { width: number; height: number; rotation: number }) => void
}

/**
 * Draggable-with-snapping behavior shared by any layer of plain rectangular
 * elements (rooms today, furniture from Milestone 5) — drag-to-move snaps
 * against the plot edges, alignment guides, and other elements' edges;
 * resize/rotate goes through a single shared Konva Transformer.
 */
export function useSnapDrag<T extends PlacedRect>({
  elements,
  selectedId,
  plot,
  guides,
  scale,
  onMove,
  onTransform,
}: UseSnapDragOptions<T>) {
  const shapeRefs = useRef(new Map<string, Konva.Rect>())
  const transformerRef = useRef<Konva.Transformer>(null)
  const [activeSnap, setActiveSnap] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return
    const node = selectedId ? shapeRefs.current.get(selectedId) : null
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedId, elements])

  function registerRef(id: string) {
    return (node: Konva.Rect | null) => {
      if (node) shapeRefs.current.set(id, node)
      else shapeRefs.current.delete(id)
    }
  }

  function handleDragMove(element: T) {
    return (event: Konva.KonvaEventObject<DragEvent>) => {
      const node = event.target
      const snapped = computeSnap(element, node.x(), node.y(), elements, plot, guides, scale)
      node.x(snapped.x)
      node.y(snapped.y)
      setActiveSnap({ x: snapped.snapX, y: snapped.snapY })
    }
  }

  function handleDragEnd(element: T) {
    return (event: Konva.KonvaEventObject<DragEvent>) => {
      onMove(element.id, event.target.x(), event.target.y())
      setActiveSnap({ x: null, y: null })
    }
  }

  function handleTransformEnd(element: T) {
    return () => {
      const node = shapeRefs.current.get(element.id)
      if (!node) return
      const scaleX = node.scaleX()
      const scaleY = node.scaleY()
      node.scaleX(1)
      node.scaleY(1)
      onTransform(element.id, {
        width: Math.round(node.width() * scaleX * 2) / 2,
        height: Math.round(node.height() * scaleY * 2) / 2,
        rotation: Math.round(node.rotation()),
      })
    }
  }

  return { shapeRefs, transformerRef, activeSnap, registerRef, handleDragMove, handleDragEnd, handleTransformEnd }
}
