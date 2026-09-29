import { ApiError } from '../apiError'
import type { HttpMethod } from '../apiClient'
import type { AuthResponseDto, UserDto } from '../authApi'
import type { FloorDto, FloorWithRoomsDto } from '../floorsApi'
import type { ProjectDetailDto, ProjectDto } from '../projectsApi'
import type { RoomDto } from '../roomsApi'
import {
  GROUND_FLOOR_NAME,
  PROJECT_DEFAULTS,
  ROOM_DEFAULTS,
  addSamplePortfolio,
  createId,
  createSeedDb,
  type DemoDb,
  type DemoProject,
  type DemoUser,
} from './seed'

/**
 * An in-browser stand-in for the FastAPI backend, used in demo mode (see lib/dataMode). It answers
 * the same routes with the same JSON shapes, status codes and error messages the frontend relies
 * on, and keeps its data in localStorage so edits survive a reload.
 */

const STORAGE_KEY = 'griha-demo-db-v1'
const TOKEN_PREFIX = 'demo.'
const MIN_PASSWORD_LENGTH = 8

let db: DemoDb | null = null

function database(): DemoDb {
  if (db) return db
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) db = JSON.parse(stored) as DemoDb
  } catch {
    // unreadable or blocked storage: start over in memory
  }
  if (!db) {
    db = createSeedDb()
    persist()
  }
  return db
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    // storage full or blocked: keep working in memory for this visit
  }
}

function now() {
  return new Date().toISOString()
}

function fail(status: number, message: string): never {
  throw new ApiError(status, message)
}

function publicUser({ password: _password, ...user }: DemoUser): UserDto {
  return user
}

function authResponse(user: DemoUser): AuthResponseDto {
  return {
    access_token: `${TOKEN_PREFIX}${user.id}`,
    refresh_token: `${TOKEN_PREFIX}${user.id}`,
    user: publicUser(user),
  }
}

function currentUser(token: string | null): DemoUser {
  const userId = token?.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length) : null
  const user = userId ? database().users.find((u) => u.id === userId) : undefined
  return user ?? fail(401, 'Could not validate credentials.')
}

function findUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase()
  return database().users.find((u) => u.email.toLowerCase() === normalized)
}

function createUser(fields: Omit<DemoUser, 'id'>): DemoUser {
  const user: DemoUser = { ...fields, id: createId() }
  database().users.push(user)
  addSamplePortfolio(database(), user.id)
  return user
}

type Body = Record<string, unknown>

function requireString(body: Body, field: string, message: string) {
  const value = body[field]
  return typeof value === 'string' && value.trim() ? value.trim() : fail(422, message)
}

// --- auth -----------------------------------------------------------------------------------

function signup(body: Body): AuthResponseDto {
  const name = requireString(body, 'name', 'Enter your name.')
  const email = requireString(body, 'email', 'Enter a valid email address.').toLowerCase()
  if (!email.includes('@')) fail(422, 'Enter a valid email address.')
  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < MIN_PASSWORD_LENGTH) fail(422, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  if (findUserByEmail(email)) fail(409, 'An account with this email already exists.')

  const user = createUser({
    name,
    email,
    password,
    phone: null,
    avatar_url: null,
    account_type: (body.account_type as UserDto['account_type']) ?? 'homeowner',
    provider: 'password',
    email_verified: false,
  })
  return authResponse(user)
}

function login(body: Body): AuthResponseDto {
  const user = typeof body.email === 'string' ? findUserByEmail(body.email) : undefined
  if (!user || !user.password || user.password !== body.password) fail(401, 'Incorrect email or password.')
  return authResponse(user)
}

/** Demo-only: signs in through a simulated provider (Google, SSO, phone OTP…), creating the account on first use. */
function providerSignIn(body: Body): AuthResponseDto {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body.phone === 'string' && body.phone ? body.phone : null
  const existing = email
    ? findUserByEmail(email)
    : database().users.find((u) => phone !== null && u.phone === phone)
  const user =
    existing ??
    createUser({
      name: typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Guest User',
      email,
      password: '',
      phone,
      avatar_url: null,
      account_type: (body.account_type as UserDto['account_type']) ?? 'homeowner',
      provider: (body.provider as UserDto['provider']) ?? 'password',
      email_verified: Boolean(email),
    })
  return authResponse(user)
}

/** Demo-only: completes the forgot-password flow, since there's no email to click through. */
function resetPassword(body: Body) {
  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < MIN_PASSWORD_LENGTH) fail(422, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  const user = typeof body.email === 'string' ? findUserByEmail(body.email) : undefined
  // Like a real reset, don't reveal whether the account exists.
  if (user) user.password = password
}

// --- projects -------------------------------------------------------------------------------

const PROJECT_FIELDS = [
  'name',
  'plot_width',
  'plot_height',
  'facing',
  'units',
  'setback_front',
  'setback_rear',
  'setback_left',
  'setback_right',
  'budget',
  'turnkey',
  'cultural_preference',
  'special_rooms',
  'notes',
  'status',
] as const satisfies readonly (keyof ProjectDto)[]

function pick<T extends object>(body: Body, fields: readonly (keyof T)[]): Partial<T> {
  return Object.fromEntries(fields.filter((f) => body[f as string] !== undefined).map((f) => [f, body[f as string]])) as Partial<T>
}

function projectSummary({ owner_id: _owner, ...project }: DemoProject): ProjectDto {
  return project
}

function ownedProject(user: DemoUser, projectId: string): DemoProject {
  const project = database().projects.find((p) => p.id === projectId && p.owner_id === user.id)
  return project ?? fail(404, 'Project not found')
}

function projectFloors(projectId: string) {
  return database()
    .floors.filter((f) => f.project_id === projectId)
    .sort((a, b) => a.level - b.level)
}

function addActivity(project: DemoProject, user: DemoUser, message: string) {
  database().activity.push({ id: createId(), project_id: project.id, user_id: user.id, message, created_at: now() })
}

function createProject(user: DemoUser, body: Body): ProjectDto {
  const timestamp = now()
  const project: DemoProject = {
    ...PROJECT_DEFAULTS,
    ...(pick<ProjectDto>(body, PROJECT_FIELDS) as Omit<ProjectDto, 'id' | 'created_at' | 'updated_at'>),
    name: requireString(body, 'name', 'Enter a project name.'),
    status: 'draft',
    id: createId(),
    owner_id: user.id,
    created_at: timestamp,
    updated_at: timestamp,
  }
  database().projects.push(project)
  database().floors.push({
    id: createId(),
    project_id: project.id,
    name: GROUND_FLOOR_NAME,
    level: 0,
    elevation: 0,
    guides: { vertical: [], horizontal: [] },
  })
  addActivity(project, user, `New project created: ${project.name}`)
  return projectSummary(project)
}

function projectDetail(project: DemoProject): ProjectDetailDto {
  return {
    ...projectSummary(project),
    floors: projectFloors(project.id),
    rooms: database().rooms.filter((r) => r.project_id === project.id),
  }
}

function deleteProject(project: DemoProject) {
  const data = database()
  data.projects = data.projects.filter((p) => p.id !== project.id)
  data.floors = data.floors.filter((f) => f.project_id !== project.id)
  data.rooms = data.rooms.filter((r) => r.project_id !== project.id)
  data.activity = data.activity.filter((a) => a.project_id !== project.id)
}

// --- floors and rooms -----------------------------------------------------------------------

const ROOM_FIELDS = [
  'name',
  'type',
  'x',
  'y',
  'width',
  'height',
  'rotation',
  'wall_height',
  'elevation',
  'color',
  'floor_finish',
  'locked',
  'visible',
  'label',
  'notes',
] as const satisfies readonly (keyof RoomDto)[]

const FLOOR_FIELDS = ['name', 'level', 'elevation', 'guides'] as const satisfies readonly (keyof FloorDto)[]

function projectFloor(project: DemoProject, floorId: string): FloorDto {
  const floor = database().floors.find((f) => f.id === floorId && f.project_id === project.id)
  return floor ?? fail(404, 'Floor not found')
}

function projectRoom(project: DemoProject, roomId: string): RoomDto {
  const room = database().rooms.find((r) => r.id === roomId && r.project_id === project.id)
  return room ?? fail(404, 'Room not found')
}

function createRoom(project: DemoProject, body: Body): RoomDto {
  let floor: FloorDto | undefined
  if (typeof body.floor_id === 'string') {
    floor = database().floors.find((f) => f.id === body.floor_id && f.project_id === project.id)
    if (!floor) fail(422, 'floor_id does not belong to this project')
  } else {
    floor = projectFloors(project.id)[0] ?? fail(409, 'Project has no floors to add rooms to')
  }
  const room: RoomDto = {
    ...ROOM_DEFAULTS,
    ...(pick<RoomDto>(body, ROOM_FIELDS) as Omit<RoomDto, 'id' | 'project_id' | 'floor_id'>),
    id: createId(),
    project_id: project.id,
    floor_id: floor.id,
  }
  database().rooms.push(room)
  return room
}

function floorPlacement(body: Body): Pick<FloorDto, 'name' | 'level' | 'elevation'> {
  const fields = pick<FloorDto>(body, ['level', 'elevation'])
  return {
    name: requireString(body, 'name', 'Enter a floor name.'),
    level: fields.level ?? fail(422, 'Enter a floor level.'),
    elevation: fields.elevation ?? 0,
  }
}

function createFloor(project: DemoProject, body: Body): FloorDto {
  const floor: FloorDto = {
    ...floorPlacement(body),
    id: createId(),
    project_id: project.id,
    guides: pick<FloorDto>(body, ['guides']).guides ?? { vertical: [], horizontal: [] },
  }
  database().floors.push(floor)
  return floor
}

function deleteFloor(project: DemoProject, floor: FloorDto) {
  if (projectFloors(project.id).length <= 1) fail(409, 'A project needs at least one floor')
  const data = database()
  data.floors = data.floors.filter((f) => f.id !== floor.id)
  data.rooms = data.rooms.filter((r) => r.floor_id !== floor.id)
}

function duplicateFloor(project: DemoProject, source: FloorDto, body: Body): FloorWithRoomsDto {
  const copy: FloorDto = {
    ...floorPlacement(body),
    id: createId(),
    project_id: project.id,
    guides: { vertical: [...source.guides.vertical], horizontal: [...source.guides.horizontal] },
  }
  const rooms = database()
    .rooms.filter((r) => r.floor_id === source.id)
    .map((r) => ({ ...r, id: createId(), floor_id: copy.id }))
  database().floors.push(copy)
  database().rooms.push(...rooms)
  return { ...copy, rooms }
}

// --- routing --------------------------------------------------------------------------------

function route(method: HttpMethod, segments: string[], body: Body, token: string | null): unknown {
  const [root, projectId, collection, itemId, action] = segments

  if (root === 'auth') {
    if (method === 'POST' && projectId === 'signup') return signup(body)
    if (method === 'POST' && projectId === 'login') return login(body)
    if (method === 'POST' && projectId === 'demo-provider') return providerSignIn(body)
    if (method === 'POST' && projectId === 'demo-reset-password') return resetPassword(body)
    if (method === 'GET' && projectId === 'me') return publicUser(currentUser(token))
  }

  if (root === 'projects') {
    const user = currentUser(token)
    if (!projectId) {
      if (method === 'GET') {
        return database()
          .projects.filter((p) => p.owner_id === user.id)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .map(projectSummary)
      }
      if (method === 'POST') return createProject(user, body)
    }

    const project = ownedProject(user, projectId)
    if (!collection) {
      if (method === 'GET') return projectDetail(project)
      if (method === 'PATCH') {
        Object.assign(project, pick<ProjectDto>(body, PROJECT_FIELDS), { updated_at: now() })
        return projectSummary(project)
      }
      if (method === 'DELETE') return deleteProject(project)
    }

    if (collection === 'activity' && method === 'GET') {
      return database()
        .activity.filter((a) => a.project_id === project.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(({ user_id: _user, ...entry }) => entry)
    }

    if (collection === 'rooms') {
      if (!itemId) {
        if (method === 'GET') return database().rooms.filter((r) => r.project_id === project.id)
        if (method === 'POST') return createRoom(project, body)
      } else {
        const room = projectRoom(project, itemId)
        if (method === 'PATCH') return Object.assign(room, pick<RoomDto>(body, ROOM_FIELDS))
        if (method === 'DELETE') {
          database().rooms = database().rooms.filter((r) => r.id !== room.id)
          return undefined
        }
      }
    }

    if (collection === 'floors') {
      if (!itemId) {
        if (method === 'GET') return projectFloors(project.id)
        if (method === 'POST') return createFloor(project, body)
      } else {
        const floor = projectFloor(project, itemId)
        if (!action && method === 'PATCH') return Object.assign(floor, pick<FloorDto>(body, FLOOR_FIELDS))
        if (!action && method === 'DELETE') return deleteFloor(project, floor)
        if (action === 'duplicate' && method === 'POST') return duplicateFloor(project, floor, body)
      }
    }
  }

  return fail(404, 'Not Found')
}

export async function handleDemoRequest(
  method: HttpMethod,
  path: string,
  body: unknown,
  token: string | null,
): Promise<unknown> {
  // Round-trip the body as the network would, so undefined fields are dropped the same way.
  const payload = body === undefined ? {} : (JSON.parse(JSON.stringify(body)) as Body)
  const segments = path.split('?')[0].split('/').filter(Boolean)
  const result = route(method, segments, payload, token)
  if (method !== 'GET') persist()
  // Hand back copies, so callers can never mutate the stored records directly.
  return result === undefined ? undefined : structuredClone(result)
}
