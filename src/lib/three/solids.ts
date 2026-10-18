import * as THREE from 'three'
import type { Shape, SolidRole } from '@/lib/drawings/massing'

/**
 * Three.js geometry and surface finish for the building's pieces (lib/drawings/massing). Plan x maps
 * to x, plan y to z, height to y. Geometry is w × h × d, centred on the origin like a BoxGeometry.
 */
export function shapeGeometry(shape: Shape | undefined, w: number, h: number, d: number): THREE.BufferGeometry {
  switch (shape?.kind) {
    case 'cylinder':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 24).scale(w, h, d)
    case 'dome': {
      // A hemisphere standing on its base.
      const geometry = new THREE.SphereGeometry(0.5, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2)
      return geometry.scale(w, h * 2, d).translate(0, -h / 2, 0)
    }
    case 'slope':
      return slopeGeometry(shape.inset, w, h, d)
    default:
      return new THREE.BoxGeometry(w, h, d)
  }
}

/** The hull of the base rectangle and the top rectangle (inset per side, possibly to a line or a point). */
function slopeGeometry(inset: { n: number; s: number; e: number; w: number }, w: number, h: number, d: number) {
  const x0 = -w / 2
  const x1 = w / 2
  const z0 = -d / 2
  const z1 = d / 2
  const tx0 = Math.min(x0 + inset.w, x1 - inset.e)
  const tx1 = Math.max(x1 - inset.e, tx0)
  const tz0 = Math.min(z0 + inset.n, z1 - inset.s)
  const tz1 = Math.max(z1 - inset.s, tz0)
  const yb = -h / 2
  const yt = h / 2
  const B = (x: number, z: number) => [x, yb, z]
  const T = (x: number, z: number) => [x, yt, z]
  // Each quad is wound counter-clockwise as seen from outside.
  const quads = [
    [B(x0, z0), B(x0, z1), B(x1, z1), B(x1, z0)], // bottom
    [T(tx0, tz0), T(tx1, tz0), T(tx1, tz1), T(tx0, tz1)], // top
    [B(x0, z0), B(x1, z0), T(tx1, tz0), T(tx0, tz0)].reverse(), // north (−z)
    [B(x1, z1), B(x0, z1), T(tx0, tz1), T(tx1, tz1)].reverse(), // south (+z)
    [B(x0, z1), B(x0, z0), T(tx0, tz0), T(tx0, tz1)].reverse(), // west (−x)
    [B(x1, z0), B(x1, z1), T(tx1, tz1), T(tx1, tz0)].reverse(), // east (+x)
  ]
  const positions: number[] = []
  for (const [a, b, c, e] of quads) positions.push(...a, ...b, ...c, ...a, ...c, ...e)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

export interface Finish {
  roughness: number
  metalness: number
}

/** How a piece's surface takes the light: matte plaster and tiles, satin wood, glossy glass, a little sheen on metal. */
export function finishFor(role: SolidRole | undefined): Finish {
  switch (role) {
    case 'glass':
    case 'railing':
      return { roughness: 0.08, metalness: 0.25 }
    case 'roof':
    case 'shade':
      return { roughness: 0.7, metalness: 0 }
    case 'door':
    case 'pergola':
    case 'fascia':
      return { roughness: 0.55, metalness: 0 }
    case 'pillar':
    case 'dome':
    case 'jharokha':
    case 'cladding':
      return { roughness: 0.75, metalness: 0 }
    default:
      return { roughness: 0.88, metalness: 0 }
  }
}
