import Konva from 'konva'
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from 'react'
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import { useElementSize } from '@/hooks/useElementSize'
import { useThemeColors } from '@/hooks/useThemeColors'
import { Ruler, RULER_SIZE } from '@/components/canvas/Ruler'
import { RoomsLayer } from '@/components/canvas/RoomsLayer'
import { useSnapDrag } from '@/components/canvas/useSnapDrag'
import { useActiveFloor, useDesignStore } from '@/stores/useDesignStore'
import type { Guides } from '@/types/design'

const GRID_STEP_FT = 5
const PADDING_PX = 40

export function PlanCanvas2D() {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const colors = useThemeColors()
  const plot = useDesignStore((state) => state.plot)
  const activeFloor = useActiveFloor()
  const rooms = activeFloor.rooms
  const guides = activeFloor.guides
  const zoom = useDesignStore((state) => state.zoom)
  const gridVisible = useDesignStore((state) => state.gridVisible)
  const selection = useDesignStore((state) => state.selection)
  const select = useDesignStore((state) => state.select)
  const selectedRoomId = selection?.type === 'room' ? selection.id : null
  const updateRoom = useDesignStore((state) => state.updateRoom)
  const addGuide = useDesignStore((state) => state.addGuide)
  const removeGuide = useDesignStore((state) => state.removeGuide)
  const zoomIn = useDesignStore((state) => state.zoomIn)
  const zoomOut = useDesignStore((state) => state.zoomOut)

  const guideDragAxisRef = useRef<keyof Guides | null>(null)
  const [guideDrag, setGuideDrag] = useState<{ axis: keyof Guides; pixel: number } | null>(null)

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null

  const baseScale =
    size.width && size.height
      ? Math.min((size.width - PADDING_PX * 2) / plot.width, (size.height - PADDING_PX * 2) / plot.height)
      : 0
  const scale = baseScale * zoom
  const offsetX = size.width ? (size.width - plot.width * scale) / 2 : 0
  const offsetY = size.height ? (size.height - plot.height * scale) / 2 : 0

  const roomDrag = useSnapDrag({
    elements: rooms,
    selectedId: selectedRoomId,
    plot,
    guides,
    scale,
    onMove: (id, x, y) => updateRoom(id, { x, y }),
    onTransform: (id, patch) => updateRoom(id, patch),
  })
  const { transformerRef, activeSnap } = roomDrag

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      const axis = guideDragAxisRef.current
      if (!axis) return
      setGuideDrag({ axis, pixel: axis === 'vertical' ? event.clientX : event.clientY })
    }
    function handleUp(event: PointerEvent) {
      const axis = guideDragAxisRef.current
      const rect = containerRef.current?.getBoundingClientRect()
      if (axis && rect) {
        const within =
          axis === 'vertical'
            ? event.clientX >= rect.left && event.clientX <= rect.right
            : event.clientY >= rect.top && event.clientY <= rect.bottom
        if (within) {
          const pixelInCanvas = axis === 'vertical' ? event.clientX - rect.left : event.clientY - rect.top
          const offsetPx = axis === 'vertical' ? offsetX : offsetY
          const positionFt = (pixelInCanvas - offsetPx) / scale
          const maxFt = axis === 'vertical' ? plot.width : plot.height
          if (positionFt >= 0 && positionFt <= maxFt) addGuide(axis, positionFt)
        }
      }
      guideDragAxisRef.current = null
      setGuideDrag(null)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [containerRef, offsetX, offsetY, scale, plot.width, plot.height, addGuide])

  function startGuideDrag(axis: keyof Guides) {
    return (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      guideDragAxisRef.current = axis
      setGuideDrag({ axis, pixel: axis === 'vertical' ? event.clientX : event.clientY })
    }
  }

  const gridLines: { key: string; points: number[] }[] = []
  if (gridVisible) {
    for (let x = 0; x <= plot.width; x += GRID_STEP_FT) {
      gridLines.push({ key: `v${x}`, points: [x, 0, x, plot.height] })
    }
    for (let y = 0; y <= plot.height; y += GRID_STEP_FT) {
      gridLines.push({ key: `h${y}`, points: [0, y, plot.width, y] })
    }
  }

  function handleWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault()
    if (event.evt.deltaY < 0) zoomIn()
    else zoomOut()
  }

  const setbackRect =
    plot.setbacks.left + plot.setbacks.right < plot.width && plot.setbacks.front + plot.setbacks.rear < plot.height
      ? {
          x: plot.setbacks.left,
          y: plot.setbacks.front,
          width: plot.width - plot.setbacks.left - plot.setbacks.right,
          height: plot.height - plot.setbacks.front - plot.setbacks.rear,
        }
      : null

  return (
    <div className="relative flex h-full w-full">
      <div className="flex shrink-0 flex-col" style={{ width: RULER_SIZE }}>
        <div style={{ height: RULER_SIZE, width: RULER_SIZE }} className="shrink-0 bg-surface-2" />
        {size.height > 0 && (
          <Ruler
            orientation="vertical"
            lengthPx={size.height}
            scale={scale}
            offsetPx={offsetY}
            plotLengthFt={plot.height}
            units={plot.units}
            guidePositions={guides.horizontal}
            colors={colors}
            onGuideDragStart={startGuideDrag('horizontal')}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {size.width > 0 && (
          <Ruler
            orientation="horizontal"
            lengthPx={size.width}
            scale={scale}
            offsetPx={offsetX}
            plotLengthFt={plot.width}
            units={plot.units}
            guidePositions={guides.vertical}
            colors={colors}
            onGuideDragStart={startGuideDrag('vertical')}
          />
        )}

        <div ref={containerRef} className="relative min-h-0 w-full flex-1">
          {size.width > 0 && size.height > 0 && (
            <Stage
              width={size.width}
              height={size.height}
              onWheel={handleWheel}
              onMouseDown={(event) => {
                if (event.target === event.target.getStage()) select(null)
              }}
            >
              <Layer x={offsetX} y={offsetY} scaleX={scale} scaleY={scale}>
                <Rect
                  x={0}
                  y={0}
                  width={plot.width}
                  height={plot.height}
                  fill={colors['--color-surface']}
                  stroke={colors['--color-text-faint']}
                  strokeWidth={0.08}
                />

                {gridLines.map((line) => (
                  <Line
                    key={line.key}
                    points={line.points}
                    stroke={colors['--color-border']}
                    strokeWidth={0.03}
                    listening={false}
                  />
                ))}

                <RoomsLayer
                  rooms={rooms}
                  units={plot.units}
                  colors={colors}
                  selectedRoomId={selectedRoomId}
                  onSelect={(id) => select({ type: 'room', id })}
                  drag={roomDrag}
                />

                {setbackRect && (
                  <Rect
                    x={setbackRect.x}
                    y={setbackRect.y}
                    width={setbackRect.width}
                    height={setbackRect.height}
                    stroke={colors['--color-text-muted']}
                    strokeWidth={0.1}
                    dash={[0.6, 0.35]}
                    listening={false}
                  />
                )}

                {guides.vertical.map((v) => (
                  <Line
                    key={`gv${v}`}
                    points={[v, 0, v, plot.height]}
                    stroke={colors['--color-accent']}
                    strokeWidth={0.12}
                    dash={[0.6, 0.35]}
                    hitStrokeWidth={0.4}
                    onDblClick={() => removeGuide('vertical', v)}
                    onDblTap={() => removeGuide('vertical', v)}
                  />
                ))}
                {guides.horizontal.map((h) => (
                  <Line
                    key={`gh${h}`}
                    points={[0, h, plot.width, h]}
                    stroke={colors['--color-accent']}
                    strokeWidth={0.12}
                    dash={[0.6, 0.35]}
                    hitStrokeWidth={0.4}
                    onDblClick={() => removeGuide('horizontal', h)}
                    onDblTap={() => removeGuide('horizontal', h)}
                  />
                ))}

                {activeSnap.x !== null && (
                  <Line
                    points={[activeSnap.x, 0, activeSnap.x, plot.height]}
                    stroke={colors['--color-primary']}
                    strokeWidth={0.14}
                    listening={false}
                  />
                )}
                {activeSnap.y !== null && (
                  <Line
                    points={[0, activeSnap.y, plot.width, activeSnap.y]}
                    stroke={colors['--color-primary']}
                    strokeWidth={0.14}
                    listening={false}
                  />
                )}

                <Transformer
                  ref={transformerRef}
                  rotateEnabled={!selectedRoom?.locked}
                  resizeEnabled={!selectedRoom?.locked}
                  borderStroke={colors['--color-primary']}
                  borderStrokeWidth={0.06}
                  anchorStroke={colors['--color-primary']}
                  anchorFill={colors['--color-surface']}
                  anchorSize={8}
                  keepRatio={false}
                  boundBoxFunc={(oldBox, newBox) =>
                    newBox.width < scale * 3 || newBox.height < scale * 3 ? oldBox : newBox
                  }
                />
              </Layer>

              <Layer listening={false}>
                <Group x={40} y={40}>
                  <Circle radius={22} fill={colors['--color-surface']} stroke={colors['--color-border-strong']} strokeWidth={1} />
                  <Line points={[0, 4, 0, -18]} stroke={colors['--color-accent']} strokeWidth={2} />
                  <Line points={[0, -18, -5, -10]} stroke={colors['--color-accent']} strokeWidth={2} />
                  <Line points={[0, -18, 5, -10]} stroke={colors['--color-accent']} strokeWidth={2} />
                  <Text x={-5} y={6} text="N" fontSize={11} fontStyle="700" fill={colors['--color-text']} />
                </Group>
              </Layer>
            </Stage>
          )}
        </div>
      </div>

      {guideDrag && (
        <div
          className="pointer-events-none fixed z-50 bg-primary/70"
          style={
            guideDrag.axis === 'vertical'
              ? { left: guideDrag.pixel, top: 0, bottom: 0, width: 1 }
              : { top: guideDrag.pixel, left: 0, right: 0, height: 1 }
          }
        />
      )}
    </div>
  )
}
