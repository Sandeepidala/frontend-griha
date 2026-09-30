import { apiRequest } from './apiClient'
import { mapFloor, type FloorDto } from './floorsApi'
import { formatRelativeTime } from './format'
import { mapRoom, toRoomBody, type RoomDto } from './roomsApi'
import type {
  LatLng,
  NewProjectInput,
  ProjectBriefUpdate,
  ProjectDetail,
  ProjectStatus,
  ProjectSummary,
  ActivityLogEntry,
  SiteLocation,
} from '@/types/project'
import type { DesignStyle, ExtraRoom, FamilyType, KitchenType, PlotShape, ProjectBrief } from '@/types/brief'
import type { Floor, LengthUnit, Plot } from '@/types/design'

export interface BriefDto {
  plot_shape: PlotShape
  plot_shape_notes: string | null
  corner_plot: boolean
  state: string | null
  city: string | null
  road_width_ft: number | null
  floors: number
  bedrooms: number
  bathrooms: number
  kitchen_type: KitchenType
  parking_cars: number
  extra_rooms: ExtraRoom[]
  family_size: number
  family_type: FamilyType
  needs_ground_floor_bedroom: boolean
  style: DesignStyle
  vastu: boolean
}

function mapBrief(dto: BriefDto): ProjectBrief {
  return {
    plotShape: dto.plot_shape,
    plotShapeNotes: dto.plot_shape_notes,
    cornerPlot: dto.corner_plot,
    state: dto.state,
    city: dto.city,
    // Briefs saved before the field existed don't carry it.
    roadWidthFt: dto.road_width_ft ?? null,
    floors: dto.floors,
    bedrooms: dto.bedrooms,
    bathrooms: dto.bathrooms,
    kitchenType: dto.kitchen_type,
    parkingCars: dto.parking_cars,
    extraRooms: dto.extra_rooms,
    familySize: dto.family_size,
    familyType: dto.family_type,
    needsGroundFloorBedroom: dto.needs_ground_floor_bedroom,
    style: dto.style,
    vastu: dto.vastu,
  }
}

export function briefToDto(brief: ProjectBrief): BriefDto {
  return {
    plot_shape: brief.plotShape,
    plot_shape_notes: brief.plotShapeNotes,
    corner_plot: brief.cornerPlot,
    state: brief.state,
    city: brief.city,
    road_width_ft: brief.roadWidthFt,
    floors: brief.floors,
    bedrooms: brief.bedrooms,
    bathrooms: brief.bathrooms,
    kitchen_type: brief.kitchenType,
    parking_cars: brief.parkingCars,
    extra_rooms: brief.extraRooms,
    family_size: brief.familySize,
    family_type: brief.familyType,
    needs_ground_floor_bedroom: brief.needsGroundFloorBedroom,
    style: brief.style,
    vastu: brief.vastu,
  }
}

export interface SiteDto {
  provider: SiteLocation['provider']
  place_id: string | null
  formatted_address: string | null
  lat: number
  lng: number
  country: string | null
  country_code: string | null
  state: string | null
  city: string | null
  postcode: string | null
  locality: string | null
  boundary: LatLng[] | null
  road_edge: number | null
  rotation_deg: number | null
  origin: LatLng | null
}

export function mapSite(dto: SiteDto | null | undefined): SiteLocation | null {
  if (!dto) return null
  return {
    provider: dto.provider,
    placeId: dto.place_id,
    formattedAddress: dto.formatted_address,
    lat: dto.lat,
    lng: dto.lng,
    country: dto.country,
    countryCode: dto.country_code,
    state: dto.state,
    city: dto.city,
    postcode: dto.postcode,
    locality: dto.locality,
    boundary: dto.boundary,
    roadEdge: dto.road_edge,
    rotationDeg: dto.rotation_deg,
    origin: dto.origin,
  }
}

export function siteToDto(site: SiteLocation | null): SiteDto | null {
  if (!site) return null
  return {
    provider: site.provider,
    place_id: site.placeId,
    formatted_address: site.formattedAddress,
    lat: site.lat,
    lng: site.lng,
    country: site.country,
    country_code: site.countryCode,
    state: site.state,
    city: site.city,
    postcode: site.postcode,
    locality: site.locality,
    boundary: site.boundary,
    road_edge: site.roadEdge,
    rotation_deg: site.rotationDeg,
    origin: site.origin,
  }
}

export interface ProjectDto {
  id: string
  name: string
  plot_width: number
  plot_height: number
  facing: Plot['facing']
  units: LengthUnit
  setback_front: number
  setback_rear: number
  setback_left: number
  setback_right: number
  budget: number
  turnkey: boolean
  brief: BriefDto
  /** Missing from demo projects saved before locations existed. */
  site?: SiteDto | null
  notes: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface ProjectDetailDto extends ProjectDto {
  floors: FloorDto[]
  rooms: RoomDto[]
}

export interface ActivityDto {
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
    units: dto.units,
    setbacks: { front: dto.setback_front, rear: dto.setback_rear, left: dto.setback_left, right: dto.setback_right },
    budget: dto.budget,
    turnkey: dto.turnkey,
    brief: mapBrief(dto.brief),
    site: mapSite(dto.site),
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

function projectBody(input: NewProjectInput | ProjectBriefUpdate) {
  return {
    name: input.name,
    plot_width: input.plotWidth,
    plot_height: input.plotHeight,
    facing: input.facing,
    budget: input.budget,
    turnkey: input.turnkey,
    brief: briefToDto(input.brief),
    site: siteToDto(input.site),
    notes: input.notes ?? null,
  }
}

export async function createProject(input: NewProjectInput): Promise<ProjectSummary> {
  const dto = await apiRequest<ProjectDto>('/projects', { method: 'POST', body: projectBody(input) })
  return mapProject(dto)
}

/** Saves the brief wizard's answers (the whole brief is replaced). */
export async function updateProjectBrief(projectId: string, input: ProjectBriefUpdate): Promise<ProjectSummary> {
  const dto = await apiRequest<ProjectDto>(`/projects/${projectId}`, { method: 'PATCH', body: projectBody(input) })
  return mapProject(dto)
}

/** Also reads review snapshots, which are ProjectDetails frozen at request time. */
export function mapDetail(dto: ProjectDetailDto): ProjectDetail {
  const floors = dto.floors.map((floor) =>
    mapFloor(
      floor,
      dto.rooms.filter((room) => room.floor_id === floor.id).map(mapRoom),
    ),
  )
  return { ...mapProject(dto), floors }
}

export async function getProject(projectId: string): Promise<ProjectDetail> {
  return mapDetail(await apiRequest<ProjectDetailDto>(`/projects/${projectId}`))
}

/** Replaces every floor and room with a new plan (e.g. a generated option) in one request. */
export async function replaceLayout(projectId: string, floors: Floor[], note?: string): Promise<ProjectDetail> {
  const dto = await apiRequest<ProjectDetailDto>(`/projects/${projectId}/layout`, {
    method: 'PUT',
    body: {
      note: note ?? null,
      floors: floors.map((floor) => ({
        name: floor.name,
        level: floor.level,
        elevation: floor.elevation,
        guides: floor.guides,
        rooms: floor.rooms.map(({ id: _id, ...room }) => toRoomBody(room)),
      })),
    },
  })
  return mapDetail(dto)
}

export async function updateProjectPlot(
  projectId: string,
  patch: Partial<Pick<ProjectSummary, 'plotWidth' | 'plotHeight' | 'facing' | 'units' | 'setbacks'>>,
): Promise<void> {
  await apiRequest(`/projects/${projectId}`, {
    method: 'PATCH',
    body: {
      plot_width: patch.plotWidth,
      plot_height: patch.plotHeight,
      facing: patch.facing,
      units: patch.units,
      setback_front: patch.setbacks?.front,
      setback_rear: patch.setbacks?.rear,
      setback_left: patch.setbacks?.left,
      setback_right: patch.setbacks?.right,
    },
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
