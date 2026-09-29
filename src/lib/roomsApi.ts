import { apiRequest } from './apiClient'
import type { FloorFinish, Room, RoomType } from '@/types/design'

export interface RoomDto {
  id: string
  project_id: string
  floor_id: string
  name: string
  type: RoomType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  wall_height: number
  elevation: number
  color: string | null
  floor_finish: FloorFinish
  locked: boolean
  visible: boolean
  label: string | null
  notes: string
}

export type RoomFields = Omit<Room, 'id'>

const API_FIELD: Record<keyof RoomFields, keyof RoomDto> = {
  name: 'name',
  type: 'type',
  x: 'x',
  y: 'y',
  width: 'width',
  height: 'height',
  rotation: 'rotation',
  wallHeight: 'wall_height',
  elevation: 'elevation',
  color: 'color',
  floorFinish: 'floor_finish',
  locked: 'locked',
  visible: 'visible',
  label: 'label',
  notes: 'notes',
}

export function mapRoom(dto: RoomDto): Room {
  return {
    id: dto.id,
    name: dto.name,
    type: dto.type,
    x: dto.x,
    y: dto.y,
    width: dto.width,
    height: dto.height,
    rotation: dto.rotation,
    wallHeight: dto.wall_height,
    elevation: dto.elevation,
    color: dto.color,
    floorFinish: dto.floor_finish,
    locked: dto.locked,
    visible: dto.visible,
    label: dto.label,
    notes: dto.notes,
  }
}

export function toRoomBody(fields: Partial<RoomFields>) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [API_FIELD[key as keyof RoomFields], value]),
  )
}

export async function createRoom(projectId: string, floorId: string, input: RoomFields): Promise<Room> {
  const dto = await apiRequest<RoomDto>(`/projects/${projectId}/rooms`, {
    method: 'POST',
    body: { ...toRoomBody(input), floor_id: floorId },
  })
  return mapRoom(dto)
}

export async function updateRoom(projectId: string, roomId: string, patch: Partial<RoomFields>): Promise<void> {
  await apiRequest(`/projects/${projectId}/rooms/${roomId}`, { method: 'PATCH', body: toRoomBody(patch) })
}

export async function deleteRoom(projectId: string, roomId: string): Promise<void> {
  await apiRequest(`/projects/${projectId}/rooms/${roomId}`, { method: 'DELETE' })
}
