import { OUTWARD, type Side } from '@/lib/drawings/geometry'

/**
 * Daylight for looking at the house from the road: the sun over the viewer's left shoulder lights the
 * front and one side (the other side falls into soft shade, which shows the form), a sky light from
 * above, and a weak bounce from behind so shaded faces keep their colour.
 */
export function HouseLights({ size, front, shadowExtent = 1.3 }: { size: number; front: Side; shadowExtent?: number }) {
  const dir = OUTWARD[front]
  // Plan y is three.js z; (dir.y, −dir.x) points to the viewer's right when facing the house.
  const sun: [number, number, number] = [dir.x * size - dir.y * size * 0.8, size * 1.6, dir.y * size + dir.x * size * 0.8]
  const bounce: [number, number, number] = [-dir.x * size, size * 0.8, -dir.y * size]
  const extent = size * shadowExtent
  return (
    <>
      <hemisphereLight args={['#f4f8ff', '#b8b29f', 1.15]} />
      <directionalLight
        position={sun}
        intensity={2.1}
        color="#fff6e8"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <directionalLight position={bounce} intensity={0.45} color="#dfe8f5" />
    </>
  )
}
