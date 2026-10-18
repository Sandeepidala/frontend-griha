import { useMemo } from 'react'
import * as THREE from 'three'
import { OUTWARD, type Side } from '@/lib/drawings/geometry'

interface HouseLightsProps {
  /** How big the scene to light is, ft: sets the sun's distance and the area it casts shadows over. */
  size: number
  front: Side
  /** Where to aim the lights (the middle of the house), three.js x and z. */
  center?: { x: number; z: number }
  shadowExtent?: number
}

/**
 * Daylight for looking at the house from the road: the sun over the viewer's left shoulder lights the
 * front and one side (the other side falls into soft shade, which shows the form), a sky light from
 * above, and a weak bounce from behind so shaded faces keep their colour. The sun and its shadow area
 * follow `center`, so a house away from the middle of a large plot still gets its shadows.
 */
export function HouseLights({ size, front, center = { x: 0, z: 0 }, shadowExtent = 1.3 }: HouseLightsProps) {
  const dir = OUTWARD[front]
  // Plan y is three.js z; (dir.y, −dir.x) points to the viewer's right when facing the house.
  const sun: [number, number, number] = [center.x + dir.x * size - dir.y * size * 0.8, size * 1.6, center.z + dir.y * size + dir.x * size * 0.8]
  const bounce: [number, number, number] = [center.x - dir.x * size, size * 0.8, center.z - dir.y * size]
  const extent = size * shadowExtent
  // A directional light shines towards its target; it has to be in the scene to take its position.
  const target = useMemo(() => new THREE.Object3D(), [])
  return (
    <>
      <primitive object={target} position={[center.x, 0, center.z]} />
      <hemisphereLight args={['#f4f8ff', '#b8b29f', 1.15]} />
      <directionalLight
        position={sun}
        target={target}
        intensity={2.1}
        color="#fff6e8"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-far={size * 6}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <directionalLight position={bounce} target={target} intensity={0.45} color="#dfe8f5" />
    </>
  )
}
