import { useMemo } from 'react'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { HouseLights } from '@/components/three/HouseLights'
import { SolidMesh } from '@/components/three/SolidMesh'
import * as THREE from 'three'
import { buildFacade } from '@/lib/drawings/facade'
import { type FloorModel, type Rect, OUTWARD, PLINTH_HEIGHT, frontSide } from '@/lib/drawings/geometry'
import type { ItemKind, PlacedItem } from '@/lib/drawings/interior'
import { type Box, MASSING_COLORS, floorShellBoxes } from '@/lib/drawings/massing'
import type { DrawingSet } from '@/lib/drawings/sheets'
import { lookFor } from '@/lib/style/kits'
import { compoundWallRects, landscapeLayout, siteContext } from '@/lib/drawings/site'
import type { FloorFinish } from '@/types/design'

export type ModelMode = 'exterior' | 'interior' | 'landscape'

const COLORS = {
  ...MASSING_COLORS,
  grass: '#9cc58a',
  lawn: '#86b873',
  road: '#5b5d61',
  paving: '#d9cfbf',
  compound: '#d2c9bb',
  trunk: '#7a5a3a',
  canopy: '#4f8f45',
  shrub: '#5f9e4f',
  planter: '#7a6a58',
  sky: '#dfe9f3',
}

const FINISH: Record<FloorFinish, string> = {
  marble: '#f2efe9',
  wood: '#b0835a',
  carpet: '#8a7f99',
  concrete: '#a3a3a3',
  tile: '#cfd3d8',
}

const ITEM_COLOR: Partial<Record<ItemKind, string>> = {
  bed: '#d9c7a8',
  'side-table': '#a47c5b',
  wardrobe: '#9c7452',
  study: '#a47c5b',
  sofa: '#7d8b99',
  armchair: '#8e9aa7',
  'coffee-table': '#6e5238',
  'tv-unit': '#4a4a4a',
  dining: '#8a6647',
  counter: '#e3dfd6',
  sink: '#c0c4c8',
  hob: '#2d2d2d',
  fridge: '#dcdcdc',
  wc: '#ffffff',
  basin: '#ffffff',
  shower: '#bcd7ea',
  'pooja-unit': '#d4a23c',
  shelf: '#b39574',
  'shoe-rack': '#9c7452',
  vehicle: '#3d5a80',
  custom: '#b0b0b0',
}

function BoxMesh({ box, base, plot, shadows = true }: { box: Box; base: number; plot: { width: number; height: number }; shadows?: boolean }) {
  const { rect, z0, z1 } = box
  const h = Math.max(0.01, z1 - z0)
  return (
    <mesh
      position={[rect.x + rect.width / 2 - plot.width / 2, base + z0 + h / 2, rect.y + rect.height / 2 - plot.height / 2]}
      castShadow={shadows && !box.opacity}
      receiveShadow={shadows}
    >
      <boxGeometry args={[Math.max(0.01, rect.width), h, Math.max(0.01, rect.height)]} />
      <meshStandardMaterial color={box.color} transparent={!!box.opacity} opacity={box.opacity ?? 1} roughness={0.85} />
    </mesh>
  )
}

function FloorShell({ model, plot, base, isTop, interior }: { model: FloorModel; plot: DrawingSet['plot']; base: number; isTop: boolean; interior: boolean }) {
  const boxes = floorShellBoxes(model, isTop, interior)
  return (
    <group>
      {model.rooms.map((room) => (
        <mesh
          key={room.id}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[room.x + room.width / 2 - plot.width / 2, base + 0.03, room.y + room.height / 2 - plot.height / 2]}
          receiveShadow
        >
          <planeGeometry args={[room.width, room.height]} />
          <meshStandardMaterial color={FINISH[room.room.floorFinish]} />
        </mesh>
      ))}
      {boxes.map((b, i) => (
        <BoxMesh key={i} box={b} base={base} plot={plot} />
      ))}
    </group>
  )
}

/** One floor's walls with its rooms' floors, for looking inside. */
function InteriorFloor({ set, floorId }: { set: DrawingSet; floorId: string }) {
  const model = set.models.find((m) => m.floor.id === floorId)
  return model ? <FloorShell model={model} plot={set.plot} base={0} isTop={false} interior /> : null
}

/** The whole house from outside, built up in the project's style (lib/drawings/facade). */
function Building({ set }: { set: DrawingSet }) {
  const facade = useMemo(() => buildFacade(set.models, set.plot, lookFor(set.brief)), [set])
  return (
    <group>
      {set.models.map((m) =>
        m.rooms.map((room) => (
          <mesh
            key={room.id}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[room.x + room.width / 2 - set.plot.width / 2, m.floor.elevation + 0.03, room.y + room.height / 2 - set.plot.height / 2]}
            receiveShadow
          >
            <planeGeometry args={[room.width, room.height]} />
            <meshStandardMaterial color={FINISH[room.room.floorFinish]} />
          </mesh>
        )),
      )}
      {facade.solids.map((solid, i) => (
        <SolidMesh key={i} solid={solid} base={-PLINTH_HEIGHT} plot={set.plot} />
      ))}
    </group>
  )
}

function Furniture({ items, plot }: { items: PlacedItem[]; plot: DrawingSet['plot'] }) {
  return (
    <group>
      {items.map((item) => {
        const inset = item.kind === 'dining' || item.kind === 'coffee-table' ? 0 : 0.05
        const box: Box = {
          rect: { x: item.x + inset, y: item.y + inset, width: item.width - inset * 2, height: item.height - inset * 2 },
          z0: item.kind === 'sink' || item.kind === 'hob' ? 2.85 : 0,
          z1: item.kind === 'sink' || item.kind === 'hob' ? 2.95 : item.verticalHeight,
          color: ITEM_COLOR[item.kind] ?? '#b0b0b0',
        }
        return <BoxMesh key={item.id} box={box} base={0} plot={plot} />
      })}
    </group>
  )
}

function Tree({ x, z, r, plot }: { x: number; z: number; r: number; plot: DrawingSet['plot'] }) {
  const px = x - plot.width / 2
  const pz = z - plot.height / 2
  const trunk = Math.max(4, r * 1.4)
  return (
    <group position={[px, 0, pz]}>
      <mesh position={[0, trunk / 2, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.35, trunk, 8]} />
        <meshStandardMaterial color={COLORS.trunk} />
      </mesh>
      <mesh position={[0, trunk + r * 0.6, 0]} castShadow>
        <sphereGeometry args={[r, 16, 12]} />
        <meshStandardMaterial color={COLORS.canopy} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Site({ set, landscape }: { set: DrawingSet; landscape: boolean }) {
  const site = siteContext(set)
  const layout = landscapeLayout(set)
  const plot = set.plot
  const P = (r: Rect, y: number) => [r.x + r.width / 2 - plot.width / 2, y, r.y + r.height / 2 - plot.height / 2] as const
  const wallH = 5
  const compound = compoundWallRects(site)
  const top = set.models[set.models.length - 1]
  const roofLevel = top ? top.floor.elevation + top.height : 0
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -PLINTH_HEIGHT - 0.02, 0]} receiveShadow>
        <planeGeometry args={[plot.width + 120, plot.height + 120]} />
        <meshStandardMaterial color={COLORS.grass} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={P(site.road, -PLINTH_HEIGHT + 0.01)} receiveShadow>
        <planeGeometry args={[site.road.width, site.road.height]} />
        <meshStandardMaterial color={COLORS.road} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={P(site.plotRect, -PLINTH_HEIGHT + 0.02)} receiveShadow>
        <planeGeometry args={[plot.width, plot.height]} />
        <meshStandardMaterial color={landscape ? COLORS.lawn : '#c9c2b4'} />
      </mesh>
      {layout.drive && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={P(layout.drive, -PLINTH_HEIGHT + 0.04)} receiveShadow>
          <planeGeometry args={[layout.drive.width, layout.drive.height]} />
          <meshStandardMaterial color={COLORS.paving} />
        </mesh>
      )}
      {compound.map((r, i) => (
        <BoxMesh key={i} box={{ rect: r, z0: -PLINTH_HEIGHT, z1: wallH - PLINTH_HEIGHT, color: COLORS.compound }} base={0} plot={plot} />
      ))}
      {landscape && (
        <group>
          {layout.trees.map((t, i) => (
            <Tree key={i} x={t.x} z={t.y} r={t.r} plot={plot} />
          ))}
          {layout.avenue.map((t, i) => (
            <Tree key={`a${i}`} x={t.x} z={t.y} r={2.5} plot={plot} />
          ))}
          {layout.shrubs.map((s, i) => (
            <mesh key={`s${i}`} position={[s.x - plot.width / 2, -PLINTH_HEIGHT + s.r, s.y - plot.height / 2]} castShadow>
              <sphereGeometry args={[s.r, 10, 8]} />
              <meshStandardMaterial color={COLORS.shrub} />
            </mesh>
          ))}
          {/* Terrace planters, unless a sloped roof covers the terrace. */}
          {lookFor(set.brief).kit.roof === 'flat' && layout.planters.map((p, i) => (
            <group key={`p${i}`}>
              <BoxMesh box={{ rect: p, z0: 0, z1: 1.5, color: COLORS.planter }} base={roofLevel} plot={plot} />
              {Array.from({ length: Math.max(1, Math.floor(p.width / 2.5)) }, (_, j) => (
                <mesh key={j} position={[p.x + 1.25 + j * 2.5 - plot.width / 2, roofLevel + 2.1, p.y + p.height / 2 - plot.height / 2]} castShadow>
                  <sphereGeometry args={[0.8, 10, 8]} />
                  <meshStandardMaterial color={COLORS.shrub} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      )}
    </group>
  )
}

function cameraFor(set: DrawingSet, mode: ModelMode): [number, number, number] {
  const size = Math.max(set.plot.width, set.plot.height)
  const dir = OUTWARD[frontSide(set.plot)]
  const top = set.models[set.models.length - 1]
  const height = top ? top.floor.elevation + top.height : 10
  if (mode === 'interior') return [size * 0.4, size * 1.25, size * 1.05]
  const dist = size * (mode === 'landscape' ? 2 : 1.75)
  // Stand in front of the road-facing side, a little to one corner.
  return [dir.x * dist + dir.y * size * 0.7, height * 1.1 + size * (mode === 'landscape' ? 0.8 : 0.45), dir.y * dist - dir.x * size * 0.7]
}

export function Model3DSheet({ set, mode, floorId }: { set: DrawingSet; mode: ModelMode; floorId: string }) {
  const interiorModel = set.models.find((m) => m.floor.id === floorId) ?? set.models[0]
  const items = mode === 'interior' && interiorModel ? set.items.get(interiorModel.floor.id) ?? [] : []
  const top = set.models[set.models.length - 1]
  const targetY = mode === 'interior' ? 0 : ((top ? top.floor.elevation + top.height : 10) / 2) * 0.8
  const size = Math.max(set.plot.width, set.plot.height)
  return (
    <Canvas
      shadows="percentage"
      // Neutral tone mapping keeps paint colours true; the default filmic curve dulls and darkens them.
      gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.NeutralToneMapping }}
      camera={{ position: cameraFor(set, mode), fov: 40, near: 0.5, far: 2000 }}
    >
      <color attach="background" args={[COLORS.sky]} />
      <HouseLights size={size} front={frontSide(set.plot)} />
      {mode === 'interior' ? (
        <group>
          {interiorModel && <InteriorFloor set={set} floorId={interiorModel.floor.id} />}
          <Furniture items={items} plot={set.plot} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
            <planeGeometry args={[set.plot.width + 40, set.plot.height + 40]} />
            <meshStandardMaterial color="#e8e4dc" />
          </mesh>
          <ContactShadows position={[0, 0.01, 0]} opacity={0.3} scale={size * 1.6} blur={2} far={10} />
        </group>
      ) : (
        <group>
          <Site set={set} landscape={mode === 'landscape'} />
          <Building set={set} />
        </group>
      )}
      <OrbitControls makeDefault target={[0, targetY, 0]} minDistance={8} maxDistance={size * 5} maxPolarAngle={Math.PI / 2 - 0.02} />
    </Canvas>
  )
}

