import { create } from 'zustand'
import type { Plot, Room } from '@/types/design'

const SAMPLE_PLOT: Plot = { width: 30, height: 40, facing: 'north' }

const SAMPLE_ROOMS: Room[] = [
  { id: 'parking', name: 'Parking', type: 'utility', x: 0, y: 0, width: 12, height: 8 },
  { id: 'foyer', name: 'Foyer', type: 'circulation', x: 12, y: 0, width: 8, height: 8 },
  { id: 'pooja', name: 'Pooja Room', type: 'pooja', x: 20, y: 0, width: 10, height: 8 },
  { id: 'living', name: 'Living Room', type: 'living', x: 0, y: 8, width: 18, height: 12 },
  { id: 'kitchen', name: 'Kitchen', type: 'kitchen', x: 18, y: 8, width: 12, height: 12 },
  { id: 'bed1', name: 'Bedroom 1', type: 'bedroom', x: 0, y: 20, width: 15, height: 10 },
  { id: 'bed2', name: 'Bedroom 2', type: 'bedroom', x: 15, y: 20, width: 15, height: 10 },
  { id: 'master', name: 'Master Bedroom', type: 'bedroom', x: 0, y: 30, width: 15, height: 10 },
  { id: 'bath', name: 'Bathroom', type: 'wet', x: 15, y: 30, width: 7, height: 10 },
  { id: 'store', name: 'Store Room', type: 'utility', x: 22, y: 30, width: 8, height: 10 },
]

export type ViewMode = '2d' | '3d' | 'split'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5

interface DesignState {
  plot: Plot
  rooms: Room[]
  selectedRoomId: string | null
  viewMode: ViewMode
  zoom: number
  gridVisible: boolean
  selectRoom: (id: string | null) => void
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

export const useDesignStore = create<DesignState>((set) => ({
  plot: SAMPLE_PLOT,
  rooms: SAMPLE_ROOMS,
  selectedRoomId: null,
  viewMode: '2d',
  zoom: 1,
  gridVisible: true,

  selectRoom: (id) => set({ selectedRoomId: id }),

  moveRoom: (id, x, y) =>
    set((state) => {
      const plot = state.plot
      return {
        rooms: state.rooms.map((room) =>
          room.id === id
            ? {
                ...room,
                x: clampToPlot(x, room.width, plot.width),
                y: clampToPlot(y, room.height, plot.height),
              }
            : room,
        ),
      }
    }),

  resizeRoom: (id, width, height) =>
    set((state) => {
      const plot = state.plot
      return {
        rooms: state.rooms.map((room) =>
          room.id === id
            ? {
                ...room,
                width: Math.max(3, Math.min(width, plot.width - room.x)),
                height: Math.max(3, Math.min(height, plot.height - room.y)),
              }
            : room,
        ),
      }
    }),

  setViewMode: (mode) => set({ viewMode: mode }),

  zoomIn: () => set((state) => ({ zoom: Math.min(MAX_ZOOM, +(state.zoom + 0.1).toFixed(2)) })),
  zoomOut: () => set((state) => ({ zoom: Math.max(MIN_ZOOM, +(state.zoom - 0.1).toFixed(2)) })),
  resetZoom: () => set({ zoom: 1 }),
  toggleGrid: () => set((state) => ({ gridVisible: !state.gridVisible })),
}))

export function useSelectedRoom() {
  return useDesignStore((state) => state.rooms.find((room) => room.id === state.selectedRoomId) ?? null)
}
