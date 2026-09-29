import { DEFAULT_BRIEF } from '../brief'
import { DEMO_ARCHITECT_EMAIL, DEMO_EMAIL, DEMO_PASSWORD } from '../dataMode'
import { briefToDto, type ActivityDto, type BriefDto, type ProjectDto } from '../projectsApi'
import type { FloorDto } from '../floorsApi'
import type { RoomDto } from '../roomsApi'
import type { UserDto } from '../authApi'
import type { ReviewCommentDto, ReviewDetailDto } from '../reviewsApi'
import type { FloorFinish, RoomType } from '@/types/design'

/** Mirrors backend/scripts/seed_demo.py so demo mode starts with the same example content. */

export interface DemoUser extends UserDto {
  password: string
}

export interface DemoProject extends ProjectDto {
  owner_id: string
}

export interface DemoActivity extends ActivityDto {
  user_id: string
}

/** Stored like the backend's design_reviews rows: people by id, list fields derived when read. */
export interface DemoReview
  extends Omit<ReviewDetailDto, 'requester' | 'architect' | 'comments' | 'project_name' | 'plot_label' | 'location'> {
  requester_id: string
  architect_id: string | null
}

export interface DemoReviewComment extends Omit<ReviewCommentDto, 'author'> {
  review_id: string
  author_id: string | null
}

export interface DemoDb {
  users: DemoUser[]
  projects: DemoProject[]
  floors: FloorDto[]
  rooms: RoomDto[]
  activity: DemoActivity[]
  reviews: DemoReview[]
  review_comments: DemoReviewComment[]
}

export function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const GROUND_FLOOR_NAME = 'Ground Floor'
const FLOOR_TO_FLOOR_HEIGHT = 10

export const PROJECT_DEFAULTS = {
  units: 'ft',
  setback_front: 3,
  setback_rear: 2,
  setback_left: 2,
  setback_right: 2,
  turnkey: false,
  brief: briefToDto(DEFAULT_BRIEF),
  notes: null,
  status: 'draft',
} satisfies Partial<ProjectDto>

/** Fills anything a stored or submitted brief leaves out, as the backend's defaults do. */
export function completeBrief(brief: Partial<BriefDto> | undefined): BriefDto {
  return { ...PROJECT_DEFAULTS.brief, ...brief }
}

export const ROOM_DEFAULTS = {
  rotation: 0,
  wall_height: 9,
  elevation: 0,
  color: null,
  floor_finish: 'tile',
  locked: false,
  visible: true,
  label: null,
  notes: '',
} satisfies Partial<RoomDto>

type SampleRoom = [name: string, type: RoomType, x: number, y: number, width: number, height: number, finish: FloorFinish, wallHeight?: number]

const SAMPLE_HOUSE: { name: string; level: number; rooms: SampleRoom[] }[] = [
  {
    name: GROUND_FLOOR_NAME,
    level: 0,
    rooms: [
      ['Parking', 'utility', 0, 0, 12, 8, 'concrete'],
      ['Foyer', 'circulation', 12, 0, 8, 8, 'marble'],
      ['Pooja Room', 'pooja', 20, 0, 10, 8, 'marble'],
      ['Living Room', 'living', 0, 8, 18, 12, 'marble', 11],
      ['Kitchen', 'kitchen', 18, 8, 12, 12, 'tile'],
      ['Bedroom 1', 'bedroom', 0, 20, 15, 10, 'wood'],
      ['Bedroom 2', 'bedroom', 15, 20, 15, 10, 'wood'],
      ['Master Bedroom', 'bedroom', 0, 30, 15, 10, 'wood', 10],
      ['Bathroom', 'wet', 15, 30, 7, 10, 'tile'],
      ['Store Room', 'utility', 22, 30, 8, 10, 'concrete'],
    ],
  },
  {
    name: 'First Floor',
    level: 1,
    rooms: [
      ['Bedroom 3', 'bedroom', 0, 0, 15, 12, 'wood'],
      ['Bedroom 4', 'bedroom', 15, 0, 15, 12, 'wood'],
      ['Family Lounge', 'living', 0, 12, 20, 10, 'marble'],
      ['Bathroom 2', 'wet', 20, 12, 10, 10, 'tile'],
    ],
  },
]

type SampleProject = Pick<
  ProjectDto,
  'name' | 'plot_width' | 'plot_height' | 'facing' | 'budget' | 'turnkey' | 'status' | 'created_at' | 'updated_at'
> & { brief: Partial<BriefDto> }

const SAMPLE_PROJECTS: SampleProject[] = [
  {
    name: 'Sharma Residence',
    plot_width: 30,
    plot_height: 40,
    facing: 'north',
    budget: 4500000,
    turnkey: false,
    brief: {
      state: 'Karnataka',
      city: 'Bengaluru',
      floors: 2,
      bedrooms: 5,
      bathrooms: 2,
      parking_cars: 1,
      extra_rooms: ['quiet_room', 'store_room'],
      family_size: 5,
      family_type: 'joint',
      needs_ground_floor_bedroom: true,
      style: 'south_indian',
    },
    status: 'ready',
    created_at: '2026-09-02T09:00:00.000Z',
    updated_at: '2026-09-14T15:30:00.000Z',
  },
  {
    name: 'Reddy Villa',
    plot_width: 40,
    plot_height: 60,
    facing: 'east',
    budget: 8500000,
    turnkey: true,
    brief: {
      corner_plot: true,
      state: 'Telangana',
      city: 'Hyderabad',
      floors: 2,
      bedrooms: 4,
      bathrooms: 4,
      kitchen_type: 'open',
      parking_cars: 2,
      extra_rooms: ['home_office', 'guest_room'],
      style: 'contemporary',
      vastu: false,
    },
    status: 'in_review',
    created_at: '2026-08-20T09:00:00.000Z',
    updated_at: '2026-09-13T11:10:00.000Z',
  },
  {
    name: 'Iyer Farmhouse',
    plot_width: 50,
    plot_height: 80,
    facing: 'south',
    budget: 12000000,
    turnkey: false,
    brief: {
      state: 'Tamil Nadu',
      city: 'Coimbatore',
      floors: 2,
      bedrooms: 5,
      bathrooms: 4,
      parking_cars: 2,
      extra_rooms: ['quiet_room', 'servant_quarters', 'utility_room'],
      family_size: 7,
      family_type: 'joint',
      needs_ground_floor_bedroom: true,
      style: 'traditional',
    },
    status: 'draft',
    created_at: '2026-09-10T09:00:00.000Z',
    updated_at: '2026-09-10T09:00:00.000Z',
  },
]

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

// (project name, message, how long before seeding it happened) — keeps the feed looking recent.
const SAMPLE_ACTIVITY: [project: string, message: string, agoMs: number][] = [
  ['Sharma Residence', 'Design generated for Sharma Residence — Vastu score 82%', 2 * HOUR_MS],
  ['Reddy Villa', 'Architect review requested for Reddy Villa', DAY_MS],
  ['Iyer Farmhouse', 'New project created: Iyer Farmhouse', 3 * DAY_MS],
  ['Sharma Residence', 'BOQ exported for Sharma Residence (PDF)', 4 * DAY_MS],
]

function addSampleHouse(db: DemoDb, projectId: string) {
  for (const { name, level, rooms } of SAMPLE_HOUSE) {
    const floor: FloorDto = {
      id: createId(),
      project_id: projectId,
      name,
      level,
      elevation: level * FLOOR_TO_FLOOR_HEIGHT,
      guides: { vertical: [], horizontal: [] },
    }
    db.floors.push(floor)
    for (const [roomName, type, x, y, width, height, finish, wallHeight] of rooms) {
      db.rooms.push({
        ...ROOM_DEFAULTS,
        id: createId(),
        project_id: projectId,
        floor_id: floor.id,
        name: roomName,
        type,
        x,
        y,
        width,
        height,
        floor_finish: finish,
        wall_height: wallHeight ?? ROOM_DEFAULTS.wall_height,
      })
    }
  }
}

/** Gives a user their own copy of the example projects, so every account starts with something to explore. */
export function addSamplePortfolio(db: DemoDb, ownerId: string, now = Date.now()) {
  const idsByName = new Map<string, string>()
  for (const sample of SAMPLE_PROJECTS) {
    const project: DemoProject = {
      ...PROJECT_DEFAULTS,
      ...sample,
      brief: completeBrief(sample.brief),
      id: createId(),
      owner_id: ownerId,
    }
    db.projects.push(project)
    idsByName.set(project.name, project.id)
    addSampleHouse(db, project.id)
  }
  for (const [projectName, message, agoMs] of SAMPLE_ACTIVITY) {
    db.activity.push({
      id: createId(),
      project_id: idsByName.get(projectName)!,
      user_id: ownerId,
      message,
      created_at: new Date(now - agoMs).toISOString(),
    })
  }
}

export function demoArchitect(): DemoUser {
  return {
    id: createId(),
    name: 'Ar. Priya Menon',
    email: DEMO_ARCHITECT_EMAIL,
    phone: null,
    avatar_url: null,
    account_type: 'homeowner',
    provider: 'password',
    email_verified: true,
    role: 'architect',
    password: DEMO_PASSWORD,
  }
}

export function createSeedDb(): DemoDb {
  const db: DemoDb = { users: [], projects: [], floors: [], rooms: [], activity: [], reviews: [], review_comments: [] }
  const demoUser: DemoUser = {
    id: createId(),
    name: 'Sandeep Gowda',
    email: DEMO_EMAIL,
    phone: null,
    avatar_url: null,
    account_type: 'builder',
    provider: 'password',
    email_verified: true,
    role: 'customer',
    password: DEMO_PASSWORD,
  }
  db.users.push(demoUser, demoArchitect())
  addSamplePortfolio(db, demoUser.id)
  return db
}
