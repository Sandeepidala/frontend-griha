import { Group, Rect, Text } from 'react-konva'
import { roomPalette } from '@/components/canvas/roomPalette'
import type { useSnapDrag } from '@/components/canvas/useSnapDrag'
import type { ThemeColors } from '@/hooks/useThemeColors'
import { formatLength } from '@/lib/units'
import type { LengthUnit, Room } from '@/types/design'

interface RoomsLayerProps {
  rooms: Room[]
  units: LengthUnit
  colors: ThemeColors
  selectedRoomId: string | null
  onSelect: (id: string) => void
  drag: ReturnType<typeof useSnapDrag<Room>>
}

export function RoomsLayer({ rooms, units, colors, selectedRoomId, onSelect, drag }: RoomsLayerProps) {
  return (
    <>
      {rooms
        .filter((room) => room.visible)
        .map((room) => {
          const palette = roomPalette(room.type, colors)
          const selected = room.id === selectedRoomId
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
                x={room.x}
                y={room.y + room.height / 2 - 0.6}
                width={room.width}
                align="center"
                text={room.label ?? room.name}
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
                text={`${formatLength(room.width, units)} × ${formatLength(room.height, units)}`}
                fontSize={0.4}
                fill={colors['--color-text-muted']}
                listening={false}
              />
            </Group>
          )
        })}
    </>
  )
}
