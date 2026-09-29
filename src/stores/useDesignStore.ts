import { create } from 'zustand'
import { ApiError } from '@/lib/apiClient'
import * as projectsApi from '@/lib/projectsApi'
import * as roomsApi from '@/lib/roomsApi'
import { toast } from '@/stores/useToastStore'
import type { Floor, FloorFinish, Guides, Plot, Room, RoomRecord, SelectionRef } from '@/types/design'

const DEFAULT_WALL_HEIGHT = 9
const DEFAULT_FLOOR_FINISH: FloorFinish = 'tile'
const FLOOR_TO_FLOOR_HEIGHT = 10

/**
 * The backend has no notion of floors yet: a project's saved rooms load onto this floor, and only
 * this floor's rooms (name, type, position and size) are saved back. Other floors are local-only.
 */
const GROUND_FLOOR_ID = 'ground'
const SAVE_DEBOUNCE_MS = 500
const PERSISTED_ROOM_FIELDS = ['name', 'type', 'x', 'y', 'width', 'height'] as const

type RoomPatch = Partial<Omit<RoomRecord, 'id'>>

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

type RoomInput = Pick<Room, 'id' | 'name' | 'type' | 'x' | 'y' | 'width' | 'height'> &
  Partial<Pick<Room, 'wallHeight' | 'floorFinish' | 'color'>>

function room(input: RoomInput): Room {
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

function groundFloor(rooms: Room[]): Floor {
  return {
    id: GROUND_FLOOR_ID,
    name: 'Ground Floor',
    level: 0,
    elevation: 0,
    rooms,
    wallOverrides: {},
    openings: [],
    furniture: [],
    staircases: [],
    guides: emptyGuides(),
  }
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
  addFloor: () => void
  removeFloor: (id: string) => void
  duplicateFloor: (id: string) => void
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

function persistedChanges(before: Room, after: Room): RoomPatch {
  return Object.fromEntries(
    PERSISTED_ROOM_FIELDS.filter((key) => before[key] !== after[key]).map((key) => [key, after[key]]),
  ) as RoomPatch
}

// Canvas drags and text fields fire updates in bursts, so saves are batched per room.
const pendingRoomSaves = new Map<string, { patch: RoomPatch; timer: number }>()

function queueRoomSave(projectId: string, target: Room, patch: RoomPatch) {
  if (Object.keys(patch).length === 0) return
  const pending = pendingRoomSaves.get(target.id)
  if (pending) window.clearTimeout(pending.timer)
  const merged = { ...pending?.patch, ...patch }
  const timer = window.setTimeout(() => {
    pendingRoomSaves.delete(target.id)
    roomsApi
      .updateRoom(projectId, target.id, merged)
      .catch(() => toast.danger(`Couldn't save changes to ${target.name}.`))
  }, SAVE_DEBOUNCE_MS)
  pendingRoomSaves.set(target.id, { patch: merged, timer })
}

function cancelRoomSave(roomId: string) {
  const pending = pendingRoomSaves.get(roomId)
  if (!pending) return
  window.clearTimeout(pending.timer)
  pendingRoomSaves.delete(roomId)
}

let pendingPlotSave: number | undefined

function queuePlotSave(projectId: string, plot: Plot) {
  window.clearTimeout(pendingPlotSave)
  pendingPlotSave = window.setTimeout(() => {
    projectsApi
      .updateProjectPlot(projectId, { plotWidth: plot.width, plotHeight: plot.height, facing: plot.facing })
      .catch(() => toast.danger("Couldn't save the plot settings."))
  }, SAVE_DEBOUNCE_MS)
}

export const useDesignStore = create<DesignState>((set, get) => ({
  projectId: null,
  plot: DEFAULT_PLOT,
  floors: [groundFloor([])],
  activeFloorId: GROUND_FLOOR_ID,
  selection: null,
  viewMode: '2d',
  zoom: 1,
  gridVisible: true,
  activeSheetId: 'site-layout',
  status: 'idle',
  error: null,

  loadProject: async (projectId) => {
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
      set({
        plot: { ...DEFAULT_PLOT, width: project.plotWidth, height: project.plotHeight, facing: project.facing },
        floors: [groundFloor(project.rooms.map(room))],
        activeFloorId: GROUND_FLOOR_ID,
        status: 'idle',
      })
    } catch (err) {
      if (get().projectId !== projectId) return
      set({ status: 'error', error: err instanceof ApiError ? err.message : 'Could not reach the server.' })
    }
  },

  select: (ref) => set({ selection: ref }),

  addRoom: async () => {
    const { plot, projectId, activeFloorId } = get()
    const width = 10
    const height = 10
    const input = {
      name: 'New Room',
      type: 'living' as const,
      x: clampToPlot((plot.width - width) / 2, width, plot.width),
      y: clampToPlot((plot.height - height) / 2, height, plot.height),
      width,
      height,
    }

    let newRoom: Room
    if (projectId && activeFloorId === GROUND_FLOOR_ID) {
      try {
        newRoom = room(await roomsApi.createRoom(projectId, input))
      } catch (err) {
        toast.danger(err instanceof ApiError ? err.message : "Couldn't add the room.")
        return
      }
      if (get().projectId !== projectId) return
    } else {
      newRoom = room({ id: createId(), ...input })
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

    if (projectId && activeFloorId === GROUND_FLOOR_ID) queueRoomSave(projectId, after, persistedChanges(before, after))
  },

  removeRoom: async (id) => {
    const { floors, activeFloorId, projectId } = get()
    const target = floors.find((f) => f.id === activeFloorId)?.rooms.find((r) => r.id === id)
    if (!target) return

    if (projectId && activeFloorId === GROUND_FLOOR_ID) {
      cancelRoomSave(id)
      try {
        await roomsApi.deleteRoom(projectId, id)
      } catch (err) {
        toast.danger(err instanceof ApiError ? err.message : `Couldn't remove ${target.name}.`)
        return
      }
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
    if (plot.width !== previousPlot.width || plot.height !== previousPlot.height || plot.facing !== previousPlot.facing) {
      queuePlotSave(projectId, plot)
    }
    // Shrinking the plot can push ground-floor rooms back inside it; those moves need saving too.
    const beforeRooms = floors.find((f) => f.id === GROUND_FLOOR_ID)?.rooms ?? []
    const afterRooms = nextFloors.find((f) => f.id === GROUND_FLOOR_ID)?.rooms ?? []
    afterRooms.forEach((after, index) => queueRoomSave(projectId, after, persistedChanges(beforeRooms[index], after)))
  },

  addGuide: (axis, position) =>
    set((state) => {
      const rounded = Math.round(position * 10) / 10
      return {
        floors: mapFloor(state.floors, state.activeFloorId, (floor) => {
          if (floor.guides[axis].some((value) => Math.abs(value - rounded) < GUIDE_MERGE_TOLERANCE_FT)) return floor
          return { ...floor, guides: { ...floor.guides, [axis]: [...floor.guides[axis], rounded].sort((a, b) => a - b) } }
        }),
      }
    }),

  removeGuide: (axis, position) =>
    set((state) => ({
      floors: mapFloor(state.floors, state.activeFloorId, (floor) => ({
        ...floor,
        guides: {
          ...floor.guides,
          [axis]: floor.guides[axis].filter((value) => Math.abs(value - position) > GUIDE_MERGE_TOLERANCE_FT),
        },
      })),
    })),

  clearGuides: () =>
    set((state) => ({
      floors: mapFloor(state.floors, state.activeFloorId, (floor) => ({ ...floor, guides: emptyGuides() })),
    })),

  addFloor: () =>
    set((state) => {
      const topElevation = Math.max(...state.floors.map((f) => f.elevation))
      const maxLevel = Math.max(...state.floors.map((f) => f.level))
      const newFloor: Floor = {
        id: createId(),
        name: `Floor ${maxLevel + 2}`,
        level: maxLevel + 1,
        elevation: topElevation + FLOOR_TO_FLOOR_HEIGHT,
        rooms: [],
        wallOverrides: {},
        openings: [],
        furniture: [],
        staircases: [],
        guides: emptyGuides(),
      }
      return { floors: [...state.floors, newFloor], activeFloorId: newFloor.id, selection: null }
    }),

  removeFloor: (id) => {
    // Deleting it locally would leave its rooms in the project, and they'd reappear on the next load.
    if (id === GROUND_FLOOR_ID && get().projectId) {
      toast.info("The ground floor holds this project's saved rooms, so it can't be removed.")
      return
    }
    set((state) => {
      if (state.floors.length <= 1) return state
      const floors = state.floors.filter((f) => f.id !== id)
      const wasActive = state.activeFloorId === id
      return {
        floors,
        activeFloorId: wasActive ? floors[0].id : state.activeFloorId,
        selection: wasActive ? null : state.selection,
      }
    })
  },

  duplicateFloor: (id) =>
    set((state) => {
      const source = state.floors.find((f) => f.id === id)
      if (!source) return state
      const topElevation = Math.max(...state.floors.map((f) => f.elevation))
      const maxLevel = Math.max(...state.floors.map((f) => f.level))
      const roomIdMap = new Map(source.rooms.map((r) => [r.id, createId()]))
      const clone: Floor = {
        ...source,
        id: createId(),
        name: `${source.name} Copy`,
        level: maxLevel + 1,
        elevation: topElevation + FLOOR_TO_FLOOR_HEIGHT,
        rooms: source.rooms.map((r) => ({ ...r, id: roomIdMap.get(r.id)! })),
        // wall overrides/openings/staircases key off wall & room ids that don't carry over cleanly
        // to the cloned rooms, so they're intentionally dropped rather than copied stale.
        wallOverrides: {},
        openings: [],
        furniture: source.furniture.map((f) => ({ ...f, id: createId() })),
        staircases: [],
        guides: { vertical: [...source.guides.vertical], horizontal: [...source.guides.horizontal] },
      }
      return { floors: [...state.floors, clone], activeFloorId: clone.id, selection: null }
    }),

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
