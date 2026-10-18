import { apiRequest } from './apiClient'
import { mapRoom, type RoomDto } from './roomsApi'
import type { Floor, Guides, OpeningEdit, Room } from '@/types/design'

export interface OpeningEditDto {
  at?: number | null
  width?: number | null
  flip_swing?: boolean | null
  flip_hinge?: boolean | null
  removed?: boolean | null
}

export interface FloorDto {
  id: string
  project_id: string
  name: string
  level: number
  elevation: number
  guides: Guides
  opening_edits?: Record<string, OpeningEditDto>
}

function editFromDto(dto: OpeningEditDto): OpeningEdit {
  const edit: OpeningEdit = {}
  if (dto.at != null) edit.at = dto.at
  if (dto.width != null) edit.width = dto.width
  if (dto.flip_swing) edit.flipSwing = true
  if (dto.flip_hinge) edit.flipHinge = true
  if (dto.removed) edit.removed = true
  return edit
}

export function editsToDto(edits: Record<string, OpeningEdit>): Record<string, OpeningEditDto> {
  return Object.fromEntries(
    Object.entries(edits).map(([key, e]) => [key, { at: e.at, width: e.width, flip_swing: e.flipSwing, flip_hinge: e.flipHinge, removed: e.removed }]),
  )
}

export interface FloorWithRoomsDto extends FloorDto {
  rooms: RoomDto[]
}

export type FloorPlacement = Pick<Floor, 'name' | 'level' | 'elevation'>

/** Wall overrides, placed openings, furniture and staircases aren't stored by the backend yet. */
export function mapFloor(dto: FloorDto, rooms: Room[]): Floor {
  return {
    id: dto.id,
    name: dto.name,
    level: dto.level,
    elevation: dto.elevation,
    rooms,
    wallOverrides: {},
    openings: [],
    openingEdits: Object.fromEntries(Object.entries(dto.opening_edits ?? {}).map(([key, e]) => [key, editFromDto(e)])),
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
  patch: Partial<FloorPlacement & { guides: Guides; openingEdits: Record<string, OpeningEdit> }>,
): Promise<void> {
  const { openingEdits, ...rest } = patch
  const body = openingEdits ? { ...rest, opening_edits: editsToDto(openingEdits) } : rest
  await apiRequest(`/projects/${projectId}/floors/${floorId}`, { method: 'PATCH', body })
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
