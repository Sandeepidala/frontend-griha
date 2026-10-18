import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { Box } from '@/lib/drawings/massing'
import { finishFor, shapeGeometry } from '@/lib/three/solids'

interface SolidMeshProps {
  solid: Box
  /** Added to the solid's heights, ft. */
  base: number
  plot: { width: number; height: number }
  shadows?: boolean
}

/** One piece of the building (a box, sloped block, column or dome), placed with the plot centred on the origin. */
export function SolidMesh({ solid, base, plot, shadows = true }: SolidMeshProps) {
  const { rect, z0, z1, shape } = solid
  const w = Math.max(0.01, rect.width)
  const h = Math.max(0.01, z1 - z0)
  const d = Math.max(0.01, rect.height)
  const geometry = useMemo(() => shapeGeometry(shape, w, h, d), [shape, w, h, d])
  useEffect(() => () => geometry.dispose(), [geometry])
  const finish = finishFor(solid.role)
  return (
    <mesh
      geometry={geometry}
      position={[rect.x + w / 2 - plot.width / 2, base + z0 + h / 2, rect.y + d / 2 - plot.height / 2]}
      castShadow={shadows && !solid.opacity}
      receiveShadow={shadows}
    >
      <meshStandardMaterial
        color={solid.color}
        transparent={!!solid.opacity}
        opacity={solid.opacity ?? 1}
        roughness={finish.roughness}
        metalness={finish.metalness}
        side={shape?.kind === 'slope' || shape?.kind === 'dome' ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  )
}
