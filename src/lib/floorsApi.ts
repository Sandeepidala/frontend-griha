import { apiRequest } from './apiClient'
import { mapRoom, type RoomDto } from './roomsApi'
import type { Floor, Guides, Room } from '@/types/design'

export interface FloorDto {
  id: string
  project_id: string
  name: string
  level: number
  elevation: number
  guides: Guides
}

export interface FloorWithRoomsDto extends FloorDto {
  rooms: RoomDto[]
}

export type FloorPlacement = Pick<Floor, 'name' | 'level' | 'elevation'>

/** Wall overrides, openings, furniture and staircases aren't stored by the backend yet. */
export function mapFloor(dto: FloorDto, rooms: Room[]): Floor {
  return {
    id: dto.id,
    name: dto.name,
    level: dto.level,
    elevation: dto.elevation,
    rooms,
    wallOverrides: {},
    openings: [],
    furniture: [],
    staircases: [],
    guides: dto.guides,
  }
}

export async function createFloor(projectId: string, input: FloorPlacement): Promise<Floor> {
  const dto = await apiRequest<FloorDto>(`/projects/${projectId}/floors`, { method: 'POST', body: input })
  return mapFloor(dto, [])
}

export async function updateFloor(
  projectId: string,
  floorId: string,
  patch: Partial<FloorPlacement & { guides: Guides }>,
): Promise<void> {
  await apiRequest(`/projects/${projectId}/floors/${floorId}`, { method: 'PATCH', body: patch })
}

export async function deleteFloor(projectId: string, floorId: string): Promise<void> {
  await apiRequest(`/projects/${projectId}/floors/${floorId}`, { method: 'DELETE' })
}

/** Copies the floor's rooms and guides server-side; `placement` names and positions the copy. */
export async function duplicateFloor(projectId: string, floorId: string, placement: FloorPlacement): Promise<Floor> {
  const dto = await apiRequest<FloorWithRoomsDto>(`/projects/${projectId}/floors/${floorId}/duplicate`, {
    method: 'POST',
    body: placement,
  })
  return mapFloor(dto, dto.rooms.map(mapRoom))
}
