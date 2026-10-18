import { type ComponentRef, useEffect, useMemo, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { type BuildSequence, RAW_COLORS, pieceProgress } from '@/lib/drawings/construction'
import { OUTWARD, frontSide } from '@/lib/drawings/geometry'
import { finishFor, shapeGeometry } from '@/lib/three/solids'
import { HouseLights } from '@/components/three/HouseLights'
import { houseFrame } from '@/lib/three/framing'
import type { BuildClock } from './buildClock'

const SCENE_COLORS = {
  sky: '#dfe9f3',
  grass: '#9cc58a',
  lawn: '#86b873',
  road: '#7b7e83',
  trunk: '#7a5a3a',
  canopy: '#4f8f45',
  shrub: '#5f9e4f',
}

const easeOutBack = (t: number) => {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}
const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

interface BuildSceneProps {
  sequence: BuildSequence
  clock: BuildClock
  /** Called when the clock reaches the end while playing. */
  onEnd: () => void
  /** Called when the viewer starts dragging the camera. */
  onGrabCamera: () => void
}

/**
 * The house being built: every piece of the sequence as a box that grows into place as the clock
 * runs, the raw brick and concrete turning into the finished colours, the bare plot turning into a
 * garden, and a camera that slowly circles from the road side.
 */
export function BuildScene({ sequence, clock, onEnd, onGrabCamera }: BuildSceneProps) {
  const { plot } = sequence
  const size = Math.max(plot.width, plot.height)
  // The camera circles the house, not the middle of the plot, at a distance set by the house's size.
  const frame = useMemo(() => houseFrame(plot, sequence.pieces.filter((p) => p.part === 'building').map((p) => p.rect)), [sequence, plot])
  const { center } = frame
  const camera = useThree((state) => state.camera)
  const aspect = useThree((state) => state.size.width / Math.max(1, state.size.height))
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const lookAt = useRef(new THREE.Vector3(center.x, 4, center.z))
  const goal = useRef(new THREE.Vector3())

  // Built once per sequence; each frame only moves, scales and recolours them.
  const scene = useMemo(() => {
    const group = new THREE.Group()
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    // Boxes share a unit cube scaled to size; roofs, columns and domes get geometry of their own size.
    const shaped: THREE.BufferGeometry[] = []
    const materials = new Map<string, { material: THREE.MeshStandardMaterial; raw: THREE.Color; finished: THREE.Color }>()
    const meshes = sequence.pieces.map((piece) => {
      const curved = !!piece.shape && piece.shape.kind !== 'box'
      const finish = finishFor(piece.role)
      const key = `${piece.raw ?? piece.color}|${piece.color}|${piece.opacity ?? 1}|${finish.roughness}|${curved}`
      let entry = materials.get(key)
      if (!entry) {
        const raw = new THREE.Color(piece.raw ?? piece.color)
        entry = {
          material: new THREE.MeshStandardMaterial({
            color: raw.clone(),
            roughness: finish.roughness,
            metalness: finish.metalness,
            transparent: !!piece.opacity,
            opacity: piece.opacity ?? 1,
            side: curved ? THREE.DoubleSide : THREE.FrontSide,
          }),
          raw,
          finished: new THREE.Color(piece.color),
        }
        materials.set(key, entry)
      }
      let pieceGeometry: THREE.BufferGeometry = geometry
      if (curved) {
        pieceGeometry = shapeGeometry(piece.shape, Math.max(0.01, piece.rect.width), Math.max(0.01, piece.z1 - piece.z0), Math.max(0.01, piece.rect.height))
        shaped.push(pieceGeometry)
      }
      const mesh = new THREE.Mesh(pieceGeometry, entry.material)
      mesh.userData.unit = !curved
      mesh.castShadow = !piece.opacity
      mesh.receiveShadow = true
      mesh.visible = false
      group.add(mesh)
      return mesh
    })

    const trunkGeometry = new THREE.CylinderGeometry(0.25, 0.35, 1, 8)
    const leafGeometry = new THREE.SphereGeometry(1, 16, 12)
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.trunk })
    const canopyMaterial = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.canopy, roughness: 0.9 })
    const shrubMaterial = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.shrub, roughness: 0.9 })
    const plants = sequence.greenery.map((p) => {
      const holder = new THREE.Group()
      holder.position.set(p.x - plot.width / 2, 0, p.y - plot.height / 2)
      if (p.kind === 'tree') {
        const trunkHeight = Math.max(4, p.r * 1.4)
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial)
        trunk.scale.set(1, trunkHeight, 1)
        trunk.position.y = trunkHeight / 2
        const canopy = new THREE.Mesh(leafGeometry, canopyMaterial)
        canopy.scale.setScalar(p.r)
        canopy.position.y = trunkHeight + p.r * 0.6
        trunk.castShadow = canopy.castShadow = true
        holder.add(trunk, canopy)
      } else {
        const shrub = new THREE.Mesh(leafGeometry, shrubMaterial)
        shrub.scale.setScalar(p.r)
        shrub.position.y = p.r
        shrub.castShadow = true
        holder.add(shrub)
      }
      holder.visible = false
      group.add(holder)
      return holder
    })

    const plotMaterial = new THREE.MeshStandardMaterial({ color: RAW_COLORS.soil })
    const dispose = () => {
      geometry.dispose()
      for (const g of shaped) g.dispose()
      trunkGeometry.dispose()
      leafGeometry.dispose()
      for (const m of materials.values()) m.material.dispose()
      trunkMaterial.dispose()
      canopyMaterial.dispose()
      shrubMaterial.dispose()
      plotMaterial.dispose()
    }
    return { group, meshes, plants, materials: [...materials.values()], plotMaterial, dispose }
  }, [sequence, plot.width, plot.height])
  useEffect(() => scene.dispose, [scene])

  const soil = useMemo(() => new THREE.Color(RAW_COLORS.soil), [])
  const lawn = useMemo(() => new THREE.Color(SCENE_COLORS.lawn), [])
  const front = OUTWARD[frontSide(plot)]
  // Swing round from one side to finish on a three-quarter view of the road side, on the side away
  // from the sun (HouseLights), so the roof's faces and the walls catch the light differently.
  const frontAngle = Math.atan2(front.y, front.x)
  const startAngle = frontAngle + 0.8
  // Further back on a tall, narrow screen (a phone held upright), so the whole house stays in view.
  const radius = frame.size * 2.6 * Math.max(1, 1.25 / aspect)

  useFrame((_, delta) => {
    if (clock.tick(delta)) onEnd()
    const t = clock.time
    let top = 0

    sequence.pieces.forEach((piece, i) => {
      const mesh = scene.meshes[i]
      const p = pieceProgress(piece, t)
      if (p <= 0) {
        mesh.visible = false
        return
      }
      mesh.visible = true
      const { rect } = piece
      const w = Math.max(0.01, rect.width)
      const d = Math.max(0.01, rect.height)
      const h = Math.max(0.01, piece.z1 - piece.z0)
      let sx = w
      let sy = h
      let sz = d
      let cx = rect.x + w / 2
      let cz = rect.y + d / 2
      if (piece.growth === 'up') sy = Math.max(0.005, h * p)
      else if (piece.growth === 'pop') {
        const k = Math.max(0.001, easeOutBack(p))
        sx = w * k
        sy = h * k
        sz = d * k
      } else {
        const k = Math.max(0.001, smooth(p))
        if (piece.from === 'N' || piece.from === 'S') {
          sz = d * k
          cz = piece.from === 'N' ? rect.y + sz / 2 : rect.y + d - sz / 2
        } else {
          sx = w * k
          cx = piece.from === 'W' ? rect.x + sx / 2 : rect.x + w - sx / 2
        }
      }
      // A unit cube scales to size; geometry made at full size scales by the fraction grown.
      if (mesh.userData.unit) mesh.scale.set(sx, sy, sz)
      else mesh.scale.set(sx / w, sy / h, sz / d)
      mesh.position.set(cx - plot.width / 2, piece.z0 + sy / 2, cz - plot.height / 2)
      if (piece.part !== 'site') top = Math.max(top, piece.z0 + sy)
    })

    sequence.greenery.forEach((plant, i) => {
      const holder = scene.plants[i]
      const p = clamp01((t - plant.start) / (plant.end - plant.start))
      holder.visible = p > 0
      if (p > 0) holder.scale.setScalar(Math.max(0.001, easeOutBack(p)))
    })

    const f = smooth(clamp01((t - sequence.finish.start) / (sequence.finish.end - sequence.finish.start)))
    for (const m of scene.materials) m.material.color.lerpColors(m.raw, m.finished, f)
    scene.plotMaterial.color.lerpColors(soil, lawn, smooth(clamp01((t - sequence.lawn.start) / (sequence.lawn.end - sequence.lawn.start))))

    // The camera circles slowly and rises with the building, looking at its middle. Its path depends
    // only on the clock, so a recorded frame is the same however fast frames are drawn; smoothing
    // is only for coming back to the path after the viewer has moved the camera.
    lookAt.current.set(center.x, Math.max(3, top * 0.55), center.z)
    if (clock.autoCamera) {
      const angle = startAngle - (t / sequence.duration) * 1.3
      const y = frame.size * 0.8 + Math.max(top, 6) * 1.05
      goal.current.set(center.x + Math.cos(angle) * radius, y, center.z + Math.sin(angle) * radius)
      const away = camera.position.distanceTo(goal.current)
      if (clock.recording || away < 0.5) camera.position.copy(goal.current)
      else camera.position.lerp(goal.current, Math.min(1, delta * 3))
      camera.lookAt(lookAt.current)
      if (controls.current) controls.current.target.copy(lookAt.current)
    }
  })

  return (
    <>
      <color attach="background" args={[SCENE_COLORS.sky]} />
      <HouseLights size={Math.max(frame.size * 1.4, 30)} front={frontSide(plot)} center={center} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <planeGeometry args={[size * 6, size * 6]} />
        <meshStandardMaterial color={SCENE_COLORS.grass} />
      </mesh>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[sequence.road.x + sequence.road.width / 2 - plot.width / 2, -0.015, sequence.road.y + sequence.road.height / 2 - plot.height / 2]}
        receiveShadow
      >
        <planeGeometry args={[sequence.road.width, sequence.road.height]} />
        <meshStandardMaterial color={SCENE_COLORS.road} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]} receiveShadow material={scene.plotMaterial}>
        <planeGeometry args={[plot.width, plot.height]} />
      </mesh>
      <primitive object={scene.group} />
      <OrbitControls
        ref={controls}
        makeDefault
        minDistance={8}
        maxDistance={Math.max(size, frame.size * 3) * 2.5}
        maxPolarAngle={Math.PI / 2 - 0.03}
        onStart={() => {
          if (clock.autoCamera) onGrabCamera()
        }}
      />
    </>
  )
}
