import Konva from 'konva'
import { useEffect, useRef } from 'react'
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import { useElementSize } from '@/hooks/useElementSize'
import { type ThemeColors, useThemeColors } from '@/hooks/useThemeColors'
import { useDesignStore } from '@/stores/useDesignStore'
import type { Room, RoomType } from '@/types/design'

const GRID_STEP_FT = 5
const PADDING_PX = 56

function roomPalette(type: RoomType, colors: ThemeColors) {
  switch (type) {
    case 'bedroom':
      return { fill: colors['--color-primary-soft'], stroke: colors['--color-primary'] }
    case 'kitchen':
      return { fill: colors['--color-warning-soft'], stroke: colors['--color-warning'] }
    case 'wet':
      return { fill: colors['--color-info-soft'], stroke: colors['--color-info'] }
    case 'pooja':
      return { fill: colors['--color-accent-soft'], stroke: colors['--color-accent'] }
    case 'circulation':
      return { fill: colors['--color-surface'], stroke: colors['--color-border-strong'] }
    case 'utility':
    case 'living':
    default:
      return { fill: colors['--color-surface-2'], stroke: colors['--color-border-strong'] }
  }
}

export function PlanCanvas2D() {
  const [containerRef, size] = useElementSize<HTMLDivElement>()
  const colors = useThemeColors()
  const plot = useDesignStore((state) => state.plot)
  const rooms = useDesignStore((state) => state.rooms)
  const zoom = useDesignStore((state) => state.zoom)
  const gridVisible = useDesignStore((state) => state.gridVisible)
  const selectedRoomId = useDesignStore((state) => state.selectedRoomId)
  const selectRoom = useDesignStore((state) => state.selectRoom)
  const moveRoom = useDesignStore((state) => state.moveRoom)
  const resizeRoom = useDesignStore((state) => state.resizeRoom)
  const zoomIn = useDesignStore((state) => state.zoomIn)
  const zoomOut = useDesignStore((state) => state.zoomOut)

  const shapeRefs = useRef(new Map<string, Konva.Rect>())
  const transformerRef = useRef<Konva.Transformer>(null)

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return
    const node = selectedRoomId ? shapeRefs.current.get(selectedRoomId) : null
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedRoomId, rooms])

  if (!size.width || !size.height) {
    return <div ref={containerRef} className="h-full w-full" />
  }

  const baseScale = Math.min(
    (size.width - PADDING_PX * 2) / plot.width,
    (size.height - PADDING_PX * 2) / plot.height,
  )
  const scale = baseScale * zoom
  const offsetX = (size.width - plot.width * scale) / 2
  const offsetY = (size.height - plot.height * scale) / 2

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

  function handleRoomTransformEnd(room: Room) {
    const node = shapeRefs.current.get(room.id)
    if (!node) return
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    node.scaleX(1)
    node.scaleY(1)
    resizeRoom(room.id, Math.round(node.width() * scaleX * 2) / 2, Math.round(node.height() * scaleY * 2) / 2)
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <Stage
        width={size.width}
        height={size.height}
        onWheel={handleWheel}
        onMouseDown={(event) => {
          if (event.target === event.target.getStage()) selectRoom(null)
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

          {rooms.map((room) => {
            const palette = roomPalette(room.type, colors)
            const selected = room.id === selectedRoomId
            return (
              <Group key={room.id}>
                <Rect
                  ref={(node) => {
                    if (node) shapeRefs.current.set(room.id, node)
                    else shapeRefs.current.delete(room.id)
                  }}
                  x={room.x}
                  y={room.y}
                  width={room.width}
                  height={room.height}
                  fill={palette.fill}
                  stroke={selected ? colors['--color-primary'] : palette.stroke}
                  strokeWidth={selected ? 0.12 : 0.06}
                  cornerRadius={0.15}
                  draggable
                  onClick={() => selectRoom(room.id)}
                  onTap={() => selectRoom(room.id)}
                  onDragEnd={(event) => moveRoom(room.id, event.target.x(), event.target.y())}
                  onTransformEnd={() => handleRoomTransformEnd(room)}
                />
                <Text
                  x={room.x}
                  y={room.y + room.height / 2 - 0.6}
                  width={room.width}
                  align="center"
                  text={room.name}
                  fontSize={0.55}
                  fontStyle="600"
                  fill={colors['--color-text']}
                  listening={false}
                />
                <Text
                  x={room.x}
                  y={room.y + room.height / 2 + 0.05}
                  width={room.width}
                  align="center"
                  text={`${room.width}' × ${room.height}'`}
                  fontSize={0.4}
                  fill={colors['--color-text-muted']}
                  listening={false}
                />
              </Group>
            )
          })}

          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
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
    </div>
  )
}
