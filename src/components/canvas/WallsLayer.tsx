import { type ReactNode, useMemo } from 'react'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Group, Line, Rect } from 'react-konva'
import type { ThemeColors } from '@/hooks/useThemeColors'
import { OUTWARD, type PlanOpening, buildFloorModel, isDoor, wallCenterOffset, wallLength, wallRect } from '@/lib/drawings/geometry'
import type { Floor, Plot } from '@/types/design'

interface WallsLayerProps {
  /**
   * `under` draws the outer walls, before the rooms (whose floors then hide where wall ends overlap
   * them at corners, as on the drawings); `over` draws the inner walls, doors and windows on top.
   */
  part: 'under' | 'over'
  floor: Floor
  floors: Floor[]
  plot: Plot
  /** Screen pixels per plan foot, for line widths that stay the same on screen. */
  scale: number
  /** Plan feet to screen pixels (the stage's coordinates), for keeping a dragged opening on its wall. */
  toScreen: (x: number, y: number) => { x: number; y: number }
  colors: ThemeColors
  selectedKey: string | null
  onSelect: (key: string) => void
  /** A door or window dragged along its wall: where its centre now is, as a fraction of the wall. */
  onMove: (key: string, at: number) => void
}

/** Plan feet, along and across an opening's wall, in the opening's own coordinates. */
const local = (horizontal: boolean, along: number, across: number) => (horizontal ? [along, across] : [across, along])

/**
 * The plan's walls (9" outer, 4½" inner), door swings and windows, as the drawing set shows them.
 * Doors and windows can be clicked to select them and dragged along their wall to move them.
 */
export function WallsLayer({ part, floor, floors, plot, scale, toScreen, colors, selectedKey, onSelect, onMove }: WallsLayerProps) {
  const model = useMemo(() => buildFloorModel(floor, floors, plot), [floor, floors, plot])
  const px = (n: number) => n / (scale || 1)
  const wallFill = colors['--color-text']
  const exterior = model.walls.filter((w) => w.exterior)
  const partitions = model.walls.filter((w) => !w.exterior)

  if (part === 'under') {
    return (
      <Group listening={false}>
        {exterior.map((w) => (
          <Rect key={w.id} {...wallRect(w)} fill={wallFill} opacity={0.82} />
        ))}
        {/* Solid floors under the (slightly see-through) room colours hide the wall ends that overlap rooms. */}
        {model.rooms.map((r) => (
          <Rect key={r.id} x={r.x} y={r.y} width={r.width} height={r.height} fill={colors['--color-surface']} />
        ))}
      </Group>
    )
  }

  return (
    <Group>
      {partitions.map((w) => (
        <Rect key={w.id} {...wallRect(w)} fill={wallFill} opacity={0.6} listening={false} />
      ))}
      {model.openings.map((o) => (
        <OpeningShape
          key={o.key}
          opening={o}
          px={px}
          toScreen={toScreen}
          colors={colors}
          selected={o.key === selectedKey}
          onSelect={onSelect}
          onMove={onMove}
        />
      ))}
    </Group>
  )
}

interface OpeningShapeProps {
  opening: PlanOpening
  px: (n: number) => number
  toScreen: WallsLayerProps['toScreen']
  colors: ThemeColors
  selected: boolean
  onSelect: (key: string) => void
  onMove: (key: string, at: number) => void
}

function OpeningShape({ opening: o, px, toScreen, colors, selected, onSelect, onMove }: OpeningShapeProps) {
  const { wall } = o
  const horizontal = wall.orientation === 'h'
  const t = wall.thickness
  const c = wall.at + wallCenterOffset(wall)
  const w = o.width
  const position = horizontal ? { x: o.center, y: c } : { x: c, y: o.center }
  const P = (along: number, across: number) => local(horizontal, along, across)
  const ink = selected ? colors['--color-primary'] : colors['--color-text']
  const door = isDoor(o)
  const length = wallLength(wall)
  const margin = w / 2 + 0.25

  // Doors: the leaf from the hinge, open at 90°, and its swing as a dashed quarter circle.
  let shapes: ReactNode
  let hit: number[]
  if (door) {
    const dir = OUTWARD[o.swingSide ?? 'S']
    const s = horizontal ? dir.y : dir.x
    const face = (s * t) / 2
    const hinge = o.hingeAtStart ? -w / 2 : w / 2
    const sign = o.hingeAtStart ? 1 : -1
    const arc: number[] = []
    for (let i = 0; i <= 16; i++) {
      const phi = (i / 16) * (Math.PI / 2)
      arc.push(...P(hinge + sign * w * Math.cos(phi), face + s * w * Math.sin(phi)))
    }
    shapes = (
      <>
        <Line points={arc} stroke={selected ? ink : colors['--color-text-muted']} strokeWidth={px(1)} dash={[px(4), px(3)]} listening={false} />
        <Line points={[...P(hinge, face), ...P(hinge, face + s * w)]} stroke={ink} strokeWidth={px(o.kind === 'main-door' ? 3 : 2)} listening={false} />
      </>
    )
    // Clickable: the opening and the swing.
    hit = [...P(-w / 2, -t / 2), ...P(w / 2, -t / 2), ...P(w / 2, face + s * w), ...P(-w / 2, face + s * w)]
  } else {
    const lines = o.kind === 'ventilator' ? [-t / 4, t / 4] : [-t / 2, 0, t / 2]
    shapes = lines.map((across, i) => (
      <Line
        key={i}
        points={[...P(-w / 2, across), ...P(w / 2, across)]}
        stroke={selected ? ink : colors['--color-info']}
        strokeWidth={px(i === 1 && lines.length === 3 ? 1 : 1.5)}
        listening={false}
      />
    ))
    const reach = Math.max(t, px(14)) / 2
    hit = [...P(-w / 2, -reach), ...P(w / 2, -reach), ...P(w / 2, reach), ...P(-w / 2, reach)]
  }

  function keepOnWall(this: unknown, pos: { x: number; y: number }) {
    const home = toScreen(position.x, position.y)
    if (length <= margin * 2) return home
    const lo = horizontal ? toScreen(wall.from + margin, c).x : toScreen(c, wall.from + margin).y
    const hi = horizontal ? toScreen(wall.to - margin, c).x : toScreen(c, wall.to - margin).y
    return horizontal ? { x: Math.min(Math.max(pos.x, lo), hi), y: home.y } : { x: home.x, y: Math.min(Math.max(pos.y, lo), hi) }
  }

  function handleDragEnd(event: KonvaEventObject<DragEvent>) {
    const node = event.target
    const along = horizontal ? node.x() : node.y()
    // Back to where the model has it; the store update then moves it to the new place.
    node.position(position)
    if (length > 0) onMove(o.key, Math.min(1, Math.max(0, (along - wall.from) / length)))
  }

  function pointer(event: KonvaEventObject<MouseEvent>, cursor: string) {
    const container = event.target.getStage()?.container()
    if (container) container.style.cursor = cursor
  }

  return (
    <Group
      x={position.x}
      y={position.y}
      draggable
      dragBoundFunc={keepOnWall}
      onDragStart={() => onSelect(o.key)}
      onDragEnd={handleDragEnd}
      onClick={(event) => {
        event.cancelBubble = true
        onSelect(o.key)
      }}
      onTap={() => onSelect(o.key)}
      onMouseEnter={(event) => pointer(event, 'grab')}
      onMouseLeave={(event) => pointer(event, '')}
    >
      {/* The wall is cut where the opening is. */}
      <Rect
        x={horizontal ? -w / 2 : -t / 2}
        y={horizontal ? -t / 2 : -w / 2}
        width={horizontal ? w : t}
        height={horizontal ? t : w}
        fill={selected ? colors['--color-primary-soft'] : colors['--color-surface']}
        listening={false}
      />
      {shapes}
      {[-w / 2, w / 2].map((along) => (
        <Line key={along} points={[...P(along, -t / 2), ...P(along, t / 2)]} stroke={ink} strokeWidth={px(1.5)} listening={false} />
      ))}
      <Line points={hit} closed fill="rgba(0,0,0,0)" strokeEnabled={false} />
    </Group>
  )
}
