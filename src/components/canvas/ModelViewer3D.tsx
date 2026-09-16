import { Billboard, ContactShadows, Edges, Line, OrbitControls, Text } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useDesignStore } from '@/stores/useDesignStore'
import type { Room, RoomType } from '@/types/design'
import type { ThemeColors } from '@/hooks/useThemeColors'

const WALL_HEIGHT = 9

function roomColor(type: RoomType, colors: ThemeColors) {
  switch (type) {
    case 'bedroom':
      return colors['--color-primary-soft']
    case 'kitchen':
      return colors['--color-warning-soft']
    case 'wet':
      return colors['--color-info-soft']
    case 'pooja':
      return colors['--color-accent-soft']
    case 'circulation':
      return colors['--color-surface']
    default:
      return colors['--color-surface-2']
  }
}

function RoomBox({ room, plotWidth, plotHeight }: { room: Room; plotWidth: number; plotHeight: number }) {
  const colors = useThemeColors()
  const selectedRoomId = useDesignStore((state) => state.selectedRoomId)
  const selectRoom = useDesignStore((state) => state.selectRoom)
  const selected = room.id === selectedRoomId

  const x = room.x + room.width / 2 - plotWidth / 2
  const z = room.y + room.height / 2 - plotHeight / 2

  return (
    <group>
      <mesh
        position={[x, WALL_HEIGHT / 2, z]}
        onClick={(event) => {
          event.stopPropagation()
          selectRoom(room.id)
        }}
      >
        <boxGeometry args={[room.width, WALL_HEIGHT, room.height]} />
        <meshStandardMaterial
          color={roomColor(room.type, colors)}
          transparent
          opacity={0.92}
        />
        <Edges color={selected ? colors['--color-primary'] : colors['--color-border-strong']} linewidth={selected ? 2 : 1} />
      </mesh>
      <Billboard position={[x, WALL_HEIGHT + 1.2, z]}>
        <Text fontSize={1.1} color={colors['--color-text']} anchorX="center" anchorY="middle">
          {room.name}
        </Text>
      </Billboard>
    </group>
  )
}

function Scene() {
  const colors = useThemeColors()
  const plot = useDesignStore((state) => state.plot)
  const rooms = useDesignStore((state) => state.rooms)
  const selectRoom = useDesignStore((state) => state.selectRoom)

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[plot.width, 30, plot.height]} intensity={1.1} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.05, 0]}
        onClick={() => selectRoom(null)}
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

      {rooms.map((room) => (
        <RoomBox key={room.id} room={room} plotWidth={plot.width} plotHeight={plot.height} />
      ))}

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
