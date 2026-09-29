import { apiRequest } from './apiClient'
import type { RoomRecord, RoomType } from '@/types/design'

interface RoomDto {
  id: string
  project_id: string
  name: string
  type: RoomType
  x: number
  y: number
  width: number
  height: number
}

function mapRoom(dto: RoomDto): RoomRecord {
  return { id: dto.id, name: dto.name, type: dto.type, x: dto.x, y: dto.y, width: dto.width, height: dto.height }
}

export async function createRoom(
  projectId: string,
  input: Omit<RoomRecord, 'id'>,
): Promise<RoomRecord> {
  const dto = await apiRequest<RoomDto>(`/projects/${projectId}/rooms`, { method: 'POST', body: input })
  return mapRoom(dto)
}

export async function updateRoom(
  projectId: string,
  roomId: string,
  patch: Partial<Omit<RoomRecord, 'id'>>,
): Promise<void> {
  await apiRequest(`/projects/${projectId}/rooms/${roomId}`, { method: 'PATCH', body: patch })
}

export async function deleteRoom(projectId: string, roomId: string): Promise<void> {
  await apiRequest(`/projects/${projectId}/rooms/${roomId}`, { method: 'DELETE' })
}
