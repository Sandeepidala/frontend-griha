import { create } from 'zustand'
import { ApiError } from '@/lib/apiClient'
import * as floorsApi from '@/lib/floorsApi'
import * as projectsApi from '@/lib/projectsApi'
import * as roomsApi from '@/lib/roomsApi'
import type { FloorPlacement } from '@/lib/floorsApi'
import type { RoomFields } from '@/lib/roomsApi'
import { toast } from '@/stores/useToastStore'
import type { Floor, FloorFinish, Guides, Plot, Room, SelectionRef } from '@/types/design'

const DEFAULT_WALL_HEIGHT = 9
const DEFAULT_FLOOR_FINISH: FloorFinish = 'tile'
const FLOOR_TO_FLOOR_HEIGHT = 10
const SAVE_DEBOUNCE_MS = 500
/** Stands in until a project's floors load, and for editing without a project. */
const PLACEHOLDER_FLOOR_ID = 'ground'

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function roomFields(input: Pick<Room, 'name' | 'type' | 'x' | 'y' | 'width' | 'height'>): RoomFields {
  return {
    rotation: 0,
    wallHeight: DEFAULT_WALL_HEIGHT,
    elevation: 0,
    color: null,
    floorFinish: DEFAULT_FLOOR_FINISH,
    locked: false,
    visible: true,
    label: null,
    notes: '',
    ...input,
  }
}

function emptyGuides(): Guides {
  return { vertical: [], horizontal: [] }
}

function emptyFloor(id: string, placement: FloorPlacement): Floor {
  return {
    id,
    ...placement,
    rooms: [],
    wallOverrides: {},
    openings: [],
    furniture: [],
    staircases: [],
    guides: emptyGuides(),
  }
}

function placeholderFloor(): Floor {
  return emptyFloor(PLACEHOLDER_FLOOR_ID, { name: 'Ground Floor', level: 0, elevation: 0 })
}

function floorAbove(floors: Floor[]) {
  const topElevation = Math.max(...floors.map((f) => f.elevation))
  const maxLevel = Math.max(...floors.map((f) => f.level))
  return { level: maxLevel + 1, elevation: topElevation + FLOOR_TO_FLOOR_HEIGHT }
}

const DEFAULT_PLOT: Plot = {
  width: 30,
  height: 40,
  facing: 'north',
  units: 'ft',
  setbacks: { front: 3, rear: 2, left: 2, right: 2 },
}

export type ViewMode = '2d' | '3d' | 'split' | 'drawings'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const MIN_ROOM_SIZE = 3
const GUIDE_MERGE_TOLERANCE_FT = 0.05

interface DesignState {
  projectId: string | null
  plot: Plot
  floors: Floor[]
  activeFloorId: string
  selection: SelectionRef
  viewMode: ViewMode
  zoom: number
  gridVisible: boolean
  /** Sheet open in the Drawings view — an id from `sheetRegister` (lib/drawings/sheets). */
  activeSheetId: string
  status: 'idle' | 'loading' | 'error'
  error: string | null
  loadProject: (projectId: string) => Promise<void>
  select: (ref: SelectionRef) => void
  addRoom: () => Promise<void>
  updateRoom: (id: string, patch: Partial<Omit<Room, 'id'>>) => void
  removeRoom: (id: string) => Promise<void>
  updatePlot: (patch: Partial<Plot>) => void
  addGuide: (axis: keyof Guides, position: number) => void
  removeGuide: (axis: keyof Guides, position: number) => void
  clearGuides: () => void
  addFloor: () => Promise<void>
  removeFloor: (id: string) => Promise<void>
  duplicateFloor: (id: string) => Promise<void>
  /** Swaps the whole plan (every floor and room) for another, e.g. a generated option. */
  replaceLayout: (floors: Floor[], note?: string) => Promise<void>
  setActiveFloorId: (id: string) => void
  setViewMode: (mode: ViewMode) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  toggleGrid: () => void
  setActiveSheetId: (id: string) => void
}

function clampToPlot(value: number, size: number, plotSize: number) {
  return Math.min(Math.max(0, value), Math.max(0, plotSize - size))
}

function normalizeGeometry(next: Room, plot: Plot): Room {
  const width = Math.max(MIN_ROOM_SIZE, Math.min(next.width, plot.width))
  const height = Math.max(MIN_ROOM_SIZE, Math.min(next.height, plot.height))
  return {
    ...next,
    width,
    height,
    x: clampToPlot(next.x, width, plot.width),
    y: clampToPlot(next.y, height, plot.height),
    rotation: ((next.rotation % 360) + 360) % 360,
  }
}

function mapFloor(floors: Floor[], floorId: string, fn: (floor: Floor) => Floor): Floor[] {
  return floors.map((floor) => (floor.id === floorId ? fn(floor) : floor))
}

function changedFields(before: Room, after: Room): Partial<RoomFields> {
  return Object.fromEntries(
    (Object.keys(after) as (keyof Room)[])
      .filter((key) => key !== 'id' && before[key] !== after[key])
      .map((key) => [key, after[key]]),
  ) as Partial<RoomFields>
}

function plotChanged(before: Plot, after: Plot) {
  const sides = ['front', 'rear', 'left', 'right'] as const
  return (
    before.width !== after.width ||
    before.height !== after.height ||
    before.facing !== after.facing ||
    before.units !== after.units ||
    sides.some((side) => before.setbacks[side] !== after.setbacks[side])
  )
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback
}

// Canvas drags, text fields and guide clicks fire updates in bursts, so saves are batched per record.
const pendingSaves = new Map<string, { patch: object; timer: number; send: () => Promise<void> }>()

function queueSave<T extends object>(key: string, patch: T, send: (merged: T) => Promise<unknown>, failure: string) {
  if (Object.keys(patch).length === 0) return
  const pending = pendingSaves.get(key)
  if (pending) window.clearTimeout(pending.timer)
  const merged = { ...(pending?.patch as T | undefined), ...patch }
  const run = async () => {
    pendingSaves.delete(key)
    try {
      await send(merged)
    } catch {
      toast.danger(failure)
    }
  }
  pendingSaves.set(key, { patch: merged, timer: window.setTimeout(run, SAVE_DEBOUNCE_MS), send: run })
}

function cancelSave(key: string) {
  const pending = pendingSaves.get(key)
  if (!pending) return
  window.clearTimeout(pending.timer)
  pendingSaves.delete(key)
}

/** Sends every batched save now, e.g. before the server copies data it may not have yet. */
async function flushSaves() {
  const pending = [...pendingSaves.values()]
  pending.forEach(({ timer }) => window.clearTimeout(timer))
  await Promise.all(pending.map(({ send }) => send()))
}

function queueRoomSave(projectId: string, target: Room, patch: Partial<RoomFields>) {
  queueSave(
    `room:${target.id}`,
    patch,
    (merged) => roomsApi.updateRoom(projectId, target.id, merged),
    `Couldn't save changes to ${target.name}.`,
  )
}

function queueGuidesSave({ projectId, floors, activeFloorId }: DesignState) {
  const floor = floors.find((f) => f.id === activeFloorId)
  if (!projectId || !floor) return
  queueSave(
    `floor:${floor.id}`,
    { guides: floor.guides },
    (merged) => floorsApi.updateFloor(projectId, floor.id, merged),
    `Couldn't save the guides on ${floor.name}.`,
  )
}

function queuePlotSave(projectId: string, plot: Plot) {
  queueSave(
    'plot',
    { plotWidth: plot.width, plotHeight: plot.height, facing: plot.facing, units: plot.units, setbacks: plot.setbacks },
    (merged) => projectsApi.updateProjectPlot(projectId, merged),
    "Couldn't save the plot settings.",
  )
}

export const useDesignStore = create<DesignState>((set, get) => ({
  projectId: null,
  plot: DEFAULT_PLOT,
  floors: [placeholderFloor()],
  activeFloorId: PLACEHOLDER_FLOOR_ID,
  selection: null,
  viewMode: '2d',
  zoom: 1,
  gridVisible: true,
  activeSheetId: 'site-layout',
  status: 'idle',
  error: null,

  loadProject: async (projectId) => {
    // Edits still batched from the previous project would otherwise be dropped or read back stale.
    void flushSaves()
    set({
      projectId,
      status: 'loading',
      error: null,
      selection: null,
      zoom: 1,
    })
    try {
      const project = await projectsApi.getProject(projectId)
      if (get().projectId !== projectId) return
      const floors = project.floors.length > 0 ? project.floors : [placeholderFloor()]
      set({
        plot: {
          width: project.plotWidth,
          height: project.plotHeight,
          facing: project.facing,
          units: project.units,
          setbacks: project.setbacks,
        },
        floors,
        activeFloorId: (floors.find((f) => f.level === 0) ?? floors[0]).id,
        status: 'idle',
      })
    } catch (err) {
      if (get().projectId !== projectId) return
      set({ status: 'error', error: errorMessage(err, 'Could not reach the server.') })
    }
  },

  select: (ref) => set({ selection: ref }),

  addRoom: async () => {
    const { plot, projectId, activeFloorId } = get()
    const width = 10
    const height = 10
    const fields = roomFields({
      name: 'New Room',
      type: 'living',
      x: clampToPlot((plot.width - width) / 2, width, plot.width),
      y: clampToPlot((plot.height - height) / 2, height, plot.height),
      width,
      height,
    })

    let newRoom: Room
    if (projectId) {
      try {
        newRoom = await roomsApi.createRoom(projectId, activeFloorId, fields)
      } catch (err) {
        toast.danger(errorMessage(err, "Couldn't add the room."))
        return
      }
      if (get().projectId !== projectId) return
    } else {
      newRoom = { id: createId(), ...fields }
    }

    set((state) => ({
      floors: mapFloor(state.floors, activeFloorId, (floor) => ({
        ...floor,
        rooms: [...floor.rooms, newRoom],
      })),
      selection: { type: 'room', id: newRoom.id },
    }))
  },

  updateRoom: (id, patch) => {
    const { floors, activeFloorId, plot, projectId } = get()
    const before = floors.find((f) => f.id === activeFloorId)?.rooms.find((r) => r.id === id)
    if (!before) return
    const after = normalizeGeometry({ ...before, ...patch }, plot)

    set((state) => ({
      floors: mapFloor(state.floors, activeFloorId, (floor) => ({
        ...floor,
        rooms: floor.rooms.map((r) => (r.id === id ? after : r)),
      })),
    }))

    if (projectId) queueRoomSave(projectId, after, changedFields(before, after))
  },

  removeRoom: async (id) => {
    const { floors, activeFloorId, projectId } = get()
    const target = floors.find((f) => f.id === activeFloorId)?.rooms.find((r) => r.id === id)
    if (!target) return

    if (projectId) {
      try {
        await roomsApi.deleteRoom(projectId, id)
      } catch (err) {
        toast.danger(errorMessage(err, `Couldn't remove ${target.name}.`))
        return
      }
      cancelSave(`room:${id}`)
      if (get().projectId !== projectId) return
    }

    set((state) => ({
      floors: mapFloor(state.floors, activeFloorId, (floor) => ({
        ...floor,
        rooms: floor.rooms.filter((r) => r.id !== id),
      })),
      selection: state.selection?.type === 'room' && state.selection.id === id ? null : state.selection,
    }))
  },

  updatePlot: (patch) => {
    const { plot: previousPlot, floors, projectId } = get()
    const plot = { ...previousPlot, ...patch }
    const nextFloors = floors.map((floor) => ({
      ...floor,
      rooms: floor.rooms.map((r) => normalizeGeometry(r, plot)),
    }))
    set({ plot, floors: nextFloors })

    if (!projectId) return
    if (plotChanged(previousPlot, plot)) queuePlotSave(projectId, plot)
    // Shrinking the plot can push rooms back inside it; those moves need saving too.
    nextFloors.forEach((floor, floorIndex) =>
      floor.rooms.forEach((after, roomIndex) =>
        queueRoomSave(projectId, after, changedFields(floors[floorIndex].rooms[roomIndex], after)),
      ),
    )
  },

  addGuide: (axis, position) => {
    set((state) => {
      const rounded = Math.round(position * 10) / 10
      return {
        floors: mapFloor(state.floors, state.activeFloorId, (floor) => {
          if (floor.guides[axis].some((value) => Math.abs(value - rounded) < GUIDE_MERGE_TOLERANCE_FT)) return floor
          return { ...floor, guides: { ...floor.guides, [axis]: [...floor.guides[axis], rounded].sort((a, b) => a - b) } }
        }),
      }
    })
    queueGuidesSave(get())
  },

  removeGuide: (axis, position) => {
    set((state) => ({
      floors: mapFloor(state.floors, state.activeFloorId, (floor) => ({
        ...floor,
        guides: {
          ...floor.guides,
          [axis]: floor.guides[axis].filter((value) => Math.abs(value - position) > GUIDE_MERGE_TOLERANCE_FT),
        },
      })),
    }))
    queueGuidesSave(get())
  },

  clearGuides: () => {
    set((state) => ({
      floors: mapFloor(state.floors, state.activeFloorId, (floor) => ({ ...floor, guides: emptyGuides() })),
    }))
    queueGuidesSave(get())
  },

  addFloor: async () => {
    const { floors, projectId } = get()
    const { level, elevation } = floorAbove(floors)
    const placement = { name: `Floor ${level + 1}`, level, elevation }

    let newFloor: Floor
    if (projectId) {
      try {
        newFloor = await floorsApi.createFloor(projectId, placement)
      } catch (err) {
        toast.danger(errorMessage(err, "Couldn't add the floor."))
        return
      }
      if (get().projectId !== projectId) return
    } else {
      newFloor = emptyFloor(createId(), placement)
    }

    set((state) => ({ floors: [...state.floors, newFloor], activeFloorId: newFloor.id, selection: null }))
  },

  removeFloor: async (id) => {
    const { floors, projectId } = get()
    const target = floors.find((f) => f.id === id)
    if (!target || floors.length <= 1) return

    if (projectId) {
      try {
        await floorsApi.deleteFloor(projectId, id)
      } catch (err) {
        toast.danger(errorMessage(err, `Couldn't delete ${target.name}.`))
        return
      }
      cancelSave(`floor:${id}`)
      target.rooms.forEach((r) => cancelSave(`room:${r.id}`))
      if (get().projectId !== projectId) return
    }

    set((state) => {
      const remaining = state.floors.filter((f) => f.id !== id)
      if (remaining.length === 0) return state
      const wasActive = state.activeFloorId === id
      return {
        floors: remaining,
        activeFloorId: wasActive ? remaining[0].id : state.activeFloorId,
        selection: wasActive ? null : state.selection,
      }
    })
  },

  duplicateFloor: async (id) => {
    const { floors, projectId } = get()
    const source = floors.find((f) => f.id === id)
    if (!source) return
    const placement = { name: `${source.name} Copy`, ...floorAbove(floors) }

    let clone: Floor
    if (projectId) {
      // The server copies what it has stored, so batched edits to this floor must land first.
      await flushSaves()
      try {
        clone = await floorsApi.duplicateFloor(projectId, id, placement)
      } catch (err) {
        toast.danger(errorMessage(err, `Couldn't duplicate ${source.name}.`))
        return
      }
      if (get().projectId !== projectId) return
    } else {
      clone = {
        ...source,
        id: createId(),
        ...placement,
        rooms: source.rooms.map((r) => ({ ...r, id: createId() })),
        // wall overrides/openings/staircases key off wall & room ids that don't carry over cleanly
        // to the cloned rooms, so they're intentionally dropped rather than copied stale.
        wallOverrides: {},
        openings: [],
        furniture: source.furniture.map((f) => ({ ...f, id: createId() })),
        staircases: [],
        guides: { vertical: [...source.guides.vertical], horizontal: [...source.guides.horizontal] },
      }
    }

    set((state) => ({ floors: [...state.floors, clone], activeFloorId: clone.id, selection: null }))
  },

  replaceLayout: async (floors, note) => {
    const { projectId } = get()
    let next: Floor[]
    if (projectId) {
      // Batched edits belong to rooms about to be replaced; send them first so none land afterwards.
      await flushSaves()
      next = (await projectsApi.replaceLayout(projectId, floors, note)).floors
      if (get().projectId !== projectId) return
    } else {
      next = floors.map((floor) => ({ ...floor, id: createId(), rooms: floor.rooms.map((r) => ({ ...r, id: createId() })) }))
    }
    const ground = next.find((f) => f.level === 0) ?? next[0]
    set({ floors: next, activeFloorId: ground.id, selection: null })
  },

  setActiveFloorId: (id) => set({ activeFloorId: id, selection: null }),

  setViewMode: (mode) => set({ viewMode: mode }),

  zoomIn: () => set((state) => ({ zoom: Math.min(MAX_ZOOM, +(state.zoom + 0.1).toFixed(2)) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(MIN_ZOOM, +(state.zoom - 0.1).toFixed(2)) })),
  resetZoom: () => set({ zoom: 1 }),
  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
  setActiveSheetId: (id) => set({ activeSheetId: id }),
}))

export function useActiveFloor() {
  return useDesignStore((state) => state.floors.find((f) => f.id === state.activeFloorId) ?? state.floors[0])
}

export function useSelectedRoom() {
  return useDesignStore((state) => {
    if (state.selection?.type !== 'room') return null
    const floor = state.floors.find((f) => f.id === state.activeFloorId)
    return floor?.rooms.find((r) => r.id === state.selection?.id) ?? null
  })
}
