import { Billboard, ContactShadows, Edges, Line, OrbitControls, Text } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { roomPalette } from '@/components/canvas/roomPalette'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useDesignStore } from '@/stores/useDesignStore'
import type { FloorFinish, Room } from '@/types/design'

const ACTIVE_OPACITY = 0.92
const GHOST_OPACITY = 0.22

function floorFinishColor(finish: FloorFinish) {
  switch (finish) {
    case 'marble':
      return '#f4f2ed'
    case 'wood':
      return '#a9784f'
    case 'carpet':
      return '#7a6f8a'
    case 'concrete':
      return '#9a9a9a'
    case 'tile':
    default:
      return '#c9ccd1'
  }
}

function degToRad(deg: number) {
  return (deg * Math.PI) / 180
}

function RoomBox({
  room,
  plotWidth,
  plotHeight,
  floorElevation,
  interactive,
}: {
  room: Room
  plotWidth: number
  plotHeight: number
  floorElevation: number
  interactive: boolean
}) {
  const colors = useThemeColors()
  const selection = useDesignStore((state) => state.selection)
  const select = useDesignStore((state) => state.select)
  const selected = interactive && selection?.type === 'room' && selection.id === room.id

  const x = room.x + room.width / 2 - plotWidth / 2
  const z = room.y + room.height / 2 - plotHeight / 2
  const baseY = floorElevation + room.elevation
  const opacity = interactive ? ACTIVE_OPACITY : GHOST_OPACITY

  return (
    <group position={[x, 0, z]} rotation={[0, degToRad(room.rotation), 0]}>
      <mesh position={[0, baseY + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={interactive}>
        <planeGeometry args={[room.width, room.height]} />
        <meshStandardMaterial color={floorFinishColor(room.floorFinish)} transparent opacity={opacity} />
      </mesh>
      <mesh
        position={[0, baseY + room.wallHeight / 2, 0]}
        onClick={
          interactive
            ? (event) => {
                event.stopPropagation()
                select({ type: 'room', id: room.id })
              }
            : undefined
        }
      >
        <boxGeometry args={[room.width, room.wallHeight, room.height]} />
        <meshStandardMaterial color={room.color ?? roomPalette(room.type, colors).fill} transparent opacity={opacity} />
        {interactive && (
          <Edges color={selected ? colors['--color-primary'] : colors['--color-border-strong']} linewidth={selected ? 2 : 1} />
        )}
      </mesh>
      {interactive && (
        <Billboard position={[0, baseY + room.wallHeight + 1.2, 0]}>
          <Text fontSize={1.1} color={colors['--color-text']} anchorX="center" anchorY="middle">
            {room.label ?? room.name}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function Scene() {
  const colors = useThemeColors()
  const plot = useDesignStore((state) => state.plot)
  const floors = useDesignStore((state) => state.floors)
  const activeFloorId = useDesignStore((state) => state.activeFloorId)
  const select = useDesignStore((state) => state.select)

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[plot.width, 30, plot.height]} intensity={1.1} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        onClick={() => select(null)}
        receiveShadow
      >
        <planeGeometry args={[plot.width * 1.6, plot.height * 1.6]} />
        <meshStandardMaterial color={colors['--color-bg']} />
      </mesh>

      <Line
        points={[
          [-plot.width / 2, 0.02, -plot.height / 2],
          [plot.width / 2, 0.02, -plot.height / 2],
          [plot.width / 2, 0.02, plot.height / 2],
          [-plot.width / 2, 0.02, plot.height / 2],
          [-plot.width / 2, 0.02, -plot.height / 2],
        ]}
        color={colors['--color-text-faint']}
        lineWidth={1.5}
      />

      {floors.map((floor) =>
        floor.rooms
          .filter((room) => room.visible)
          .map((room) => (
            <RoomBox
              key={room.id}
              room={room}
              plotWidth={plot.width}
              plotHeight={plot.height}
              floorElevation={floor.elevation}
              interactive={floor.id === activeFloorId}
            />
          )),
      )}

      <Billboard position={[0, 0.6, -plot.height / 2 - 3]}>
        <Text fontSize={1.4} color={colors['--color-accent']} anchorX="center" anchorY="middle">
          N ▲
        </Text>
      </Billboard>

      <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={Math.max(plot.width, plot.height) * 1.6} blur={2} far={12} />
      <OrbitControls makeDefault minDistance={10} maxDistance={120} maxPolarAngle={Math.PI / 2 - 0.02} />
    </>
  )
}

export function ModelViewer3D() {
  const plot = useDesignStore((state) => state.plot)

  return (
    <div className="h-full w-full">
      <Canvas
        shadows
        camera={{ position: [plot.width * 0.9, plot.height * 0.85, plot.height * 0.95], fov: 45 }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
