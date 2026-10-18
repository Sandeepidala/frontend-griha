import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomChange } from '@/lib/chatApi'
import type { Floor, Room } from '@/types/design'

const api = vi.hoisted(() => ({
  createRoom: vi.fn(),
  updateRoom: vi.fn(),
  deleteRoom: vi.fn(),
}))
vi.mock('@/lib/roomsApi', () => api)
// The API client reads the saved session when it loads, so storage must exist first.
vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} })

const { useDesignStore } = await import('./useDesignStore')

function room(id: string, name: string, x: number, width: number): Room {
  return {
    id,
    name,
    type: 'living',
    x,
    y: 4,
    width,
    height: 14,
    rotation: 0,
    wallHeight: 9,
    elevation: 0,
    color: null,
    floorFinish: 'tile',
    locked: false,
    visible: true,
    label: null,
    notes: '',
  }
}

function floor(id: string, level: number, rooms: Room[]): Floor {
  return { id, name: `Floor ${level}`, level, elevation: level * 10, rooms, wallOverrides: {}, openings: [], furniture: [], staircases: [], guides: { vertical: [], horizontal: [] } }
}

const living = room('living', 'Living Room', 4, 12)
const kitchen = room('kitchen', 'Kitchen', 16, 10)
const bedroom = room('bedroom', 'Bedroom', 4, 12)
const pooja = room('pooja', 'Pooja Room', 22, 5)

// The assistant took 2 ft from the living room for the kitchen, removed the upstairs bedroom and added a pooja room.
const changes: RoomChange[] = [
  { kind: 'updated', floorId: 'ground', room: { ...living, width: 10 }, before: living },
  { kind: 'updated', floorId: 'ground', room: { ...kitchen, x: 14, width: 12 }, before: kitchen },
  { kind: 'removed', floorId: 'first', room: null, before: bedroom },
  { kind: 'added', floorId: 'ground', room: pooja, before: null },
]

const rooms = (floorId: string) => useDesignStore.getState().floors.find((f) => f.id === floorId)!.rooms

describe("the design assistant's changes in the editor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useDesignStore.setState({
      projectId: 'project',
      floors: [floor('ground', 0, [living, kitchen]), floor('first', 1, [bedroom])],
      activeFloorId: 'ground',
      selection: { type: 'room', id: 'bedroom' },
    })
  })

  it('shows saved changes on every floor without saving them again', () => {
    useDesignStore.getState().applyRoomChanges(changes)

    expect(rooms('ground').map((r) => [r.name, r.x, r.width])).toEqual([
      ['Living Room', 4, 10],
      ['Kitchen', 14, 12],
      ['Pooja Room', 22, 5],
    ])
    expect(rooms('first')).toEqual([])
    // The removed room was selected.
    expect(useDesignStore.getState().selection).toBeNull()
    expect(api.updateRoom).not.toHaveBeenCalled()
  })

  it('undoes them, saving each step, and keeps later edits to the same rooms', async () => {
    useDesignStore.getState().applyRoomChanges(changes)
    useDesignStore.setState((state) => ({
      floors: state.floors.map((f) => ({ ...f, rooms: f.rooms.map((r) => (r.id === 'kitchen' ? { ...r, color: '#ff0000' } : r)) })),
    }))
    api.createRoom.mockResolvedValue({ ...bedroom, id: 'bedroom-2' })

    const ok = await useDesignStore.getState().revertRoomChanges(changes)

    expect(ok).toBe(true)
    expect(api.deleteRoom).toHaveBeenCalledWith('project', 'pooja')
    expect(api.createRoom).toHaveBeenCalledWith('project', 'first', expect.objectContaining({ name: 'Bedroom', width: 12 }))
    expect(api.updateRoom).toHaveBeenCalledWith('project', 'kitchen', { name: 'Kitchen', type: 'living', x: 16, y: 4, width: 10, height: 14 })
    expect(rooms('ground').map((r) => [r.name, r.x, r.width])).toEqual([
      ['Living Room', 4, 12],
      ['Kitchen', 16, 10],
    ])
    expect(rooms('ground')[1].color).toBe('#ff0000')
    expect(rooms('first').map((r) => r.id)).toEqual(['bedroom-2'])
  })

  it('stops at the first failure and shows what was undone', async () => {
    useDesignStore.getState().applyRoomChanges(changes)
    api.deleteRoom.mockResolvedValue(undefined)
    api.createRoom.mockRejectedValue(new Error('offline'))

    const ok = await useDesignStore.getState().revertRoomChanges(changes)

    expect(ok).toBe(false)
    expect(rooms('ground').map((r) => r.name)).toEqual(['Living Room', 'Kitchen'])
    expect(rooms('ground')[1].width).toBe(12)
    expect(api.updateRoom).not.toHaveBeenCalled()
  })
})
