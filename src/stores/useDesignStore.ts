import { create } from 'zustand'
import { ApiError } from '@/lib/apiClient'
import * as projectsApi from '@/lib/projectsApi'
import * as roomsApi from '@/lib/roomsApi'
import { toast } from '@/stores/useToastStore'
import { ROOM_TYPE_LABELS, type Plot, type Room, type RoomType } from '@/types/design'

const DEFAULT_PLOT: Plot = { width: 30, height: 40, facing: 'north' }

export type ViewMode = '2d' | '3d' | 'split'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5

interface DesignState {
  projectId: string | null
  plot: Plot
  rooms: Room[]
  selectedRoomId: string | null
  viewMode: ViewMode
  zoom: number
  gridVisible: boolean
  status: 'idle' | 'loading' | 'error'
  error: string | null
  loadProject: (projectId: string) => Promise<void>
  selectRoom: (id: string | null) => void
  addRoom: (type: RoomType) => Promise<void>
  removeRoom: (id: string) => Promise<void>
  moveRoom: (id: string, x: number, y: number) => void
  resizeRoom: (id: string, width: number, height: number) => void
  setViewMode: (mode: ViewMode) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
  toggleGrid: () => void
}

function clampToPlot(value: number, size: number, plotSize: number) {
  return Math.min(Math.max(0, value), Math.max(0, plotSize - size))
}

export const useDesignStore = create<DesignState>((set, get) => ({
  projectId: null,
  plot: DEFAULT_PLOT,
  rooms: [],
  selectedRoomId: null,
  viewMode: '2d',
  zoom: 1,
  gridVisible: true,
  status: 'idle',
  error: null,

  loadProject: async (projectId) => {
    set({
      projectId,
      status: 'loading',
      error: null,
      selectedRoomId: null,
      zoom: 1,
    })
    try {
      const project = await projectsApi.getProject(projectId)
      set({
        plot: { width: project.plotWidth, height: project.plotHeight, facing: project.facing },
        rooms: project.rooms,
        status: 'idle',
      })
    } catch (err) {
      set({ status: 'error', error: err instanceof ApiError ? err.message : 'Could not reach the server.' })
    }
  },

  selectRoom: (id) => set({ selectedRoomId: id }),

  addRoom: async (type) => {
    const { plot, rooms, projectId } = get()
    if (!projectId) return

    const width = Math.min(10, plot.width)
    const height = Math.min(10, plot.height)
    const sameTypeCount = rooms.filter((r) => r.type === type).length
    const label = ROOM_TYPE_LABELS[type]
    const name = sameTypeCount === 0 ? label : `${label} ${sameTypeCount + 1}`

    try {
      const room = await roomsApi.createRoom(projectId, { name, type, x: 0, y: 0, width, height })
      set({ rooms: [...get().rooms, room], selectedRoomId: room.id })
    } catch (err) {
      toast.danger(err instanceof ApiError ? err.message : "Couldn't add the room.")
    }
  },

  removeRoom: async (id) => {
    const { rooms, projectId, selectedRoomId } = get()
    const room = rooms.find((r) => r.id === id)
    if (!room || !projectId) return

    try {
      await roomsApi.deleteRoom(projectId, id)
      set({
        rooms: rooms.filter((r) => r.id !== id),
        selectedRoomId: selectedRoomId === id ? null : selectedRoomId,
      })
    } catch (err) {
      toast.danger(err instanceof ApiError ? err.message : `Couldn't remove ${room.name}.`)
    }
  },

  moveRoom: (id, x, y) => {
    const { plot, rooms, projectId } = get()
    const room = rooms.find((r) => r.id === id)
    if (!room) return
    const clampedX = clampToPlot(x, room.width, plot.width)
    const clampedY = clampToPlot(y, room.height, plot.height)

    set({ rooms: rooms.map((r) => (r.id === id ? { ...r, x: clampedX, y: clampedY } : r)) })

    if (projectId) {
      roomsApi
        .updateRoom(projectId, id, { x: clampedX, y: clampedY })
        .catch(() => toast.danger(`Couldn't save the new position for ${room.name}.`))
    }
  },

  resizeRoom: (id, width, height) => {
    const { plot, rooms, projectId } = get()
    const room = rooms.find((r) => r.id === id)
    if (!room) return
    const clampedWidth = Math.max(3, Math.min(width, plot.width - room.x))
    const clampedHeight = Math.max(3, Math.min(height, plot.height - room.y))

    set({
      rooms: rooms.map((r) => (r.id === id ? { ...r, width: clampedWidth, height: clampedHeight } : r)),
    })

    if (projectId) {
      roomsApi
        .updateRoom(projectId, id, { width: clampedWidth, height: clampedHeight })
        .catch(() => toast.danger(`Couldn't save the new size for ${room.name}.`))
    }
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  zoomIn: () => set((state) => ({ zoom: Math.min(MAX_ZOOM, +(state.zoom + 0.1).toFixed(2)) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(MIN_ZOOM, +(state.zoom - 0.1).toFixed(2)) })),
  resetZoom: () => set({ zoom: 1 }),
  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
}))

export function useSelectedRoom() {
  return useDesignStore((state) => state.rooms.find((room) => room.id === state.selectedRoomId) ?? null)
}
