import { Group, Rect, Text } from 'react-konva'
import { roomPalette } from '@/components/canvas/roomPalette'
import type { useSnapDrag } from '@/components/canvas/useSnapDrag'
import type { ThemeColors } from '@/hooks/useThemeColors'
import { formatArea, formatLength } from '@/lib/units'
import type { LengthUnit, Room } from '@/types/design'

interface RoomsLayerProps {
  rooms: Room[]
  units: LengthUnit
  /** Screen pixels per plan foot, so the labels can be sized on screen. */
  scale: number
  zoom: number
  colors: ThemeColors
  selectedRoomId: string | null
  onSelect: (id: string) => void
  drag: ReturnType<typeof useSnapDrag<Room>>
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
/** About how wide a character of the label font is, as a share of its size. */
const CHAR_WIDTH = 0.62

/**
 * A room's label sizes in screen pixels: readable at any zoom (a little larger as you zoom in),
 * shrunk to fit a small room, with the size and area lines left out where they don't fit.
 */
function labelLayout(room: Room, name: string, scale: number, zoom: number) {
  const width = room.width * scale
  const height = room.height * scale
  const grow = clamp(Math.sqrt(zoom), 1, 1.5)
  const nameSize = clamp(Math.min(13 * grow, (width - 8) / (Math.max(name.length, 4) * CHAR_WIDTH), height * 0.3), 9, 20)
  const detailSize = clamp(Math.min(11 * grow, height * 0.22), 8, 16)
  const showSize = height >= nameSize + detailSize + 10 && width >= 44
  const showArea = showSize && height >= nameSize + detailSize * 2 + 18 && width >= 64
  return { nameSize, detailSize, showSize, showArea }
}

export function RoomsLayer({ rooms, units, scale, zoom, colors, selectedRoomId, onSelect, drag }: RoomsLayerProps) {
  return (
    <>
      {rooms
        .filter((room) => room.visible)
        .map((room) => {
          const palette = roomPalette(room.type, colors)
          const selected = room.id === selectedRoomId
          const name = room.label ?? room.name
          const { nameSize, detailSize, showSize, showArea } = labelLayout(room, name, scale || 1, zoom)
          // Lay the lines out in screen pixels, centred in the room, then convert to plan feet.
          const gap = 3
          const block = nameSize + (showSize ? gap + detailSize : 0) + (showArea ? gap + detailSize : 0)
          const ft = (px: number) => px / (scale || 1)
          const top = room.y + room.height / 2 - ft(block / 2)
          return (
            <Group key={room.id}>
              <Rect
                ref={drag.registerRef(room.id)}
                x={room.x}
                y={room.y}
                width={room.width}
                height={room.height}
                rotation={room.rotation}
                fill={room.color ?? palette.fill}
                stroke={selected ? colors['--color-primary'] : palette.stroke}
                strokeWidth={selected ? 0.12 : 0.06}
                cornerRadius={0.15}
                draggable={!room.locked}
                onClick={() => onSelect(room.id)}
                onTap={() => onSelect(room.id)}
                onDragMove={drag.handleDragMove(room)}
                onDragEnd={drag.handleDragEnd(room)}
                onTransformEnd={drag.handleTransformEnd(room)}
              />
              <Text
                x={room.x + ft(4)}
                y={top}
                width={Math.max(0, room.width - ft(8))}
                align="center"
                text={name}
                fontSize={ft(nameSize)}
                fontStyle="600"
                fill={colors['--color-text']}
                wrap="none"
                ellipsis
                listening={false}
              />
              {showSize && (
                <Text
                  x={room.x + ft(4)}
                  y={top + ft(nameSize + gap)}
                  width={Math.max(0, room.width - ft(8))}
                  align="center"
                  text={`${formatLength(room.width, units)} × ${formatLength(room.height, units)}`}
                  fontSize={ft(detailSize)}
                  fill={colors['--color-text-muted']}
                  wrap="none"
                  ellipsis
                  listening={false}
                />
              )}
              {showArea && (
                <Text
                  x={room.x + ft(4)}
                  y={top + ft(nameSize + gap + detailSize + gap)}
                  width={Math.max(0, room.width - ft(8))}
                  align="center"
                  text={formatArea(room.width * room.height, units)}
                  fontSize={ft(detailSize)}
                  fill={colors['--color-text-faint']}
                  wrap="none"
                  ellipsis
                  listening={false}
                />
              )}
            </Group>
          )
        })}
    </>
  )
}
