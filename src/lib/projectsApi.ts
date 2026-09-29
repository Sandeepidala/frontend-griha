import { apiRequest } from './apiClient'
import { mapFloor, type FloorDto } from './floorsApi'
import { formatRelativeTime } from './format'
import { mapRoom, type RoomDto } from './roomsApi'
import type {
  CulturalPreference,
  NewProjectInput,
  ProjectDetail,
  ProjectStatus,
  ProjectSummary,
  ActivityLogEntry,
} from '@/types/project'
import type { Plot } from '@/types/design'

interface ProjectDto {
  id: string
  name: string
  plot_width: number
  plot_height: number
  facing: Plot['facing']
  budget: number
  turnkey: boolean
  cultural_preference: CulturalPreference
  special_rooms: string[]
  notes: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
}

interface ProjectDetailDto extends ProjectDto {
  floors: FloorDto[]
  rooms: RoomDto[]
}

interface ActivityDto {
  id: string
  project_id: string
  message: string
  created_at: string
}

function mapProject(dto: ProjectDto): ProjectSummary {
  return {
    id: dto.id,
    name: dto.name,
    plotWidth: dto.plot_width,
    plotHeight: dto.plot_height,
    facing: dto.facing,
    budget: dto.budget,
    turnkey: dto.turnkey,
    culturalPreference: dto.cultural_preference,
    specialRooms: dto.special_rooms,
    notes: dto.notes ?? undefined,
    status: dto.status,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  }
}

function mapActivity(dto: ActivityDto): ActivityLogEntry {
  return { id: dto.id, message: dto.message, time: formatRelativeTime(dto.created_at) }
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const dtos = await apiRequest<ProjectDto[]>('/projects')
  return dtos.map(mapProject)
}

export async function createProject(input: NewProjectInput): Promise<ProjectSummary> {
  const dto = await apiRequest<ProjectDto>('/projects', {
    method: 'POST',
    body: {
      name: input.name,
      plot_width: input.plotWidth,
      plot_height: input.plotHeight,
      facing: input.facing,
      budget: input.budget,
      turnkey: input.turnkey,
      cultural_preference: input.culturalPreference,
      special_rooms: input.specialRooms,
      notes: input.notes ?? null,
    },
  })
  return mapProject(dto)
}

export async function getProject(projectId: string): Promise<ProjectDetail> {
  const dto = await apiRequest<ProjectDetailDto>(`/projects/${projectId}`)
  const floors = dto.floors.map((floor) =>
    mapFloor(
      floor,
      dto.rooms.filter((room) => room.floor_id === floor.id).map(mapRoom),
    ),
  )
  return { ...mapProject(dto), floors }
}

export async function updateProjectPlot(
  projectId: string,
  patch: Partial<Pick<ProjectSummary, 'plotWidth' | 'plotHeight' | 'facing'>>,
): Promise<void> {
  await apiRequest(`/projects/${projectId}`, {
    method: 'PATCH',
    body: { plot_width: patch.plotWidth, plot_height: patch.plotHeight, facing: patch.facing },
  })
}

async function listProjectActivityDtos(projectId: string): Promise<ActivityDto[]> {
  return apiRequest<ActivityDto[]>(`/projects/${projectId}/activity`)
}

export async function listRecentActivity(projectIds: string[], limit = 10): Promise<ActivityLogEntry[]> {
  const perProject = await Promise.all(projectIds.map(listProjectActivityDtos))
  return perProject
    .flat()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map(mapActivity)
}
