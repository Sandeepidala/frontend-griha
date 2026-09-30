import { ApiError } from '../apiError'
import type { HttpMethod } from '../apiClient'
import type { AuthResponseDto, UserDto } from '../authApi'
import type { FloorDto, FloorWithRoomsDto } from '../floorsApi'
import type { BriefDto, ProjectDetailDto, ProjectDto } from '../projectsApi'
import { handleDemoGeo } from './geo'
import type { ReviewDetailDto, ReviewPartyDto, ReviewQuoteDto, ReviewSummaryDto } from '../reviewsApi'
import type { RoomDto } from '../roomsApi'
import { DEMO_ARCHITECT_EMAIL } from '../dataMode'
import {
  GROUND_FLOOR_NAME,
  PROJECT_DEFAULTS,
  ROOM_DEFAULTS,
  addSamplePortfolio,
  completeBrief,
  createId,
  createSeedDb,
  demoArchitect,
  type DemoDb,
  type DemoProject,
  type DemoReview,
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
    if (stored) db = upgradeStoredReviews(upgradeStoredProjects(JSON.parse(stored) as DemoDb))
  } catch {
    // unreadable or blocked storage: start over in memory
  }
  if (!db) {
    db = createSeedDb()
    persist()
  }
  return db
}

// Projects saved before the brief existed, converted the same way as backend migration 0004.
const LEGACY_SPECIAL_ROOMS: Record<string, BriefDto['extra_rooms'][number]> = {
  'Pooja / prayer room': 'quiet_room',
  'Home office': 'home_office',
  'Servant quarters': 'servant_quarters',
  'Store room': 'store_room',
}

function upgradeStoredProjects(data: DemoDb): DemoDb {
  for (const project of data.projects as (DemoProject & { cultural_preference?: string; special_rooms?: string[] })[]) {
    if (project.brief) continue
    const rooms = project.special_rooms ?? []
    project.brief = completeBrief({
      vastu: project.cultural_preference === 'hindu',
      extra_rooms: [...new Set(rooms.flatMap((room) => LEGACY_SPECIAL_ROOMS[room] ?? []))],
    })
    delete project.cultural_preference
    delete project.special_rooms
  }
  return data
}

// Databases saved before architect reviews: add roles, the review tables and the demo architect.
function upgradeStoredReviews(data: DemoDb): DemoDb {
  data.reviews ??= []
  data.review_comments ??= []
  for (const user of data.users) {
    user.role ??= 'customer'
    user.email_notifications ??= true
  }
  if (!data.users.some((u) => u.email === DEMO_ARCHITECT_EMAIL)) data.users.push(demoArchitect())
  return data
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

function publicUser({ password: _password, token_version: _version, ...user }: DemoUser): UserDto {
  return user
}

function authResponse(user: DemoUser): AuthResponseDto {
  const token = `${TOKEN_PREFIX}${user.id}.${user.token_version ?? 0}`
  return { access_token: token, refresh_token: token, user: publicUser(user) }
}

/** Tokens are "demo.<user id>.<version>"; ones from before versions ("demo.<user id>") count as version 0. */
function currentUser(token: string | null): DemoUser {
  const [userId, version = '0'] = token?.startsWith(TOKEN_PREFIX) ? token.slice(TOKEN_PREFIX.length).split('.') : []
  const user = userId ? database().users.find((u) => u.id === userId) : undefined
  if (!user || Number(version) !== (user.token_version ?? 0)) fail(401, 'Could not validate credentials.')
  return user
}

// --- account (mirrors the backend's /auth/change-password, /auth/logout-all, /auth/me) -------

function changePassword(user: DemoUser, body: Body): AuthResponseDto {
  if (!user.password || body.current_password !== user.password) fail(403, "That password isn't right.")
  const next = typeof body.new_password === 'string' ? body.new_password : ''
  if (next.length < MIN_PASSWORD_LENGTH) fail(422, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  user.password = next
  user.token_version = (user.token_version ?? 0) + 1
  return authResponse(user)
}

function exportData(user: DemoUser) {
  const data = database()
  const projects = data.projects.filter((p) => p.owner_id === user.id)
  const ids = new Set(projects.map((p) => p.id))
  return {
    exported_at: now(),
    account: publicUser(user),
    projects: projects.map(projectDetail),
    activity: data.activity.filter((a) => ids.has(a.project_id)).map(({ user_id: _user, ...entry }) => entry),
    assistant_messages: [],
    architect_reviews: data.reviews.filter((r) => r.requester_id === user.id).map(reviewDetail),
    review_comments_written: data.review_comments
      .filter((c) => c.author_id === user.id && data.reviews.find((r) => r.id === c.review_id)?.requester_id !== user.id)
      .map(({ author_id: _author, ...comment }) => comment),
  }
}

function deleteAccount(user: DemoUser, body: Body) {
  if (user.password ? body.password !== user.password : String(body.confirm_email ?? '').trim().toLowerCase() !== user.email) {
    fail(403, user.password ? "That password isn't right." : 'Type your email address to confirm.')
  }
  const data = database()
  for (const project of data.projects.filter((p) => p.owner_id === user.id)) deleteProject(project)
  const requested = new Set(data.reviews.filter((r) => r.requester_id === user.id).map((r) => r.id))
  data.reviews = data.reviews.filter((r) => !requested.has(r.id))
  data.review_comments = data.review_comments
    .filter((c) => !requested.has(c.review_id))
    .map((c) => (c.author_id === user.id ? { ...c, author_id: null } : c))
  for (const review of data.reviews) {
    if (review.architect_id === user.id && review.status === 'in_review') Object.assign(review, { status: 'queued', architect_id: null, claimed_at: null })
  }
  data.users = data.users.filter((u) => u.id !== user.id)
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
    role: 'customer',
    email_notifications: true,
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
      role: 'customer',
      email_notifications: true,
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
  'brief',
  'site',
  'notes',
  'status',
] as const satisfies readonly (keyof ProjectDto)[]

/** Like the backend: an explicit null only clears `notes`, and a brief is completed with defaults. */
function projectChanges(body: Body): Partial<ProjectDto> {
  const changes = pick<ProjectDto>(body, PROJECT_FIELDS)
  for (const key of Object.keys(changes) as (keyof ProjectDto)[]) {
    if (changes[key] === null && key !== 'notes' && key !== 'site') delete changes[key]
  }
  if (changes.name !== undefined && !String(changes.name).trim()) fail(422, 'Enter a project name.')
  if (changes.brief) changes.brief = completeBrief(changes.brief)
  return changes
}

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
    ...(projectChanges(body) as Omit<ProjectDto, 'id' | 'created_at' | 'updated_at'>),
    name: requireString(body, 'name', 'Enter a project name.'),
    brief: completeBrief(body.brief as Partial<BriefDto> | undefined),
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
  const reviewIds = new Set(data.reviews.filter((r) => r.project_id === project.id).map((r) => r.id))
  data.reviews = data.reviews.filter((r) => !reviewIds.has(r.id))
  data.review_comments = data.review_comments.filter((c) => !reviewIds.has(c.review_id))
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

/** Swaps every floor and room of a project for a new plan, as the backend's PUT /layout does. */
function replaceLayout(user: DemoUser, project: DemoProject, body: Body): ProjectDetailDto {
  const floors = Array.isArray(body.floors) ? (body.floors as Body[]) : []
  if (floors.length === 0 || floors.length > 4) fail(422, 'A layout needs between one and four floors.')
  const levels = floors.map((f) => f.level)
  if (new Set(levels).size !== levels.length) fail(422, 'Each floor needs its own level.')
  // Check every floor before touching anything, so a bad one can't leave the plan half-replaced.
  floors.forEach((f) => floorPlacement(f))
  const data = database()
  data.floors = data.floors.filter((f) => f.project_id !== project.id)
  data.rooms = data.rooms.filter((r) => r.project_id !== project.id)
  for (const layoutFloor of floors) {
    const floor = createFloor(project, layoutFloor)
    for (const room of Array.isArray(layoutFloor.rooms) ? (layoutFloor.rooms as Body[]) : []) {
      createRoom(project, { ...room, floor_id: floor.id })
    }
  }
  if (typeof body.note === 'string' && body.note) addActivity(project, user, body.note)
  return projectDetail(project)
}

// --- architect reviews (mirrors backend app/api/routes/reviews.py) --------------------------

// Placeholders, as in the backend's settings.
const REVIEW_FEE = 4999
const REVIEW_GST_RATE = 0.18
const REVIEW_TURNAROUND_DAYS = 3
const ACTIVE_REVIEW: DemoReview['status'][] = ['awaiting_payment', 'queued', 'in_review']

function reviewQuote(): ReviewQuoteDto {
  const tax = Math.round(REVIEW_FEE * REVIEW_GST_RATE)
  return {
    fee: REVIEW_FEE,
    tax,
    total: REVIEW_FEE + tax,
    tax_rate: REVIEW_GST_RATE,
    turnaround_days: REVIEW_TURNAROUND_DAYS,
    payments: 'simulated',
  }
}

function party(userId: string | null): ReviewPartyDto | null {
  const user = userId ? database().users.find((u) => u.id === userId) : undefined
  return user ? { id: user.id, name: user.name, role: user.role ?? 'customer' } : null
}

function reviewSummary({ requester_id, architect_id, snapshot, ...review }: DemoReview): ReviewSummaryDto {
  const location = [snapshot.brief?.city, snapshot.brief?.state].filter(Boolean).join(', ')
  return {
    ...review,
    requester: party(requester_id)!,
    architect: party(architect_id),
    project_name: snapshot.name,
    plot_label: `${snapshot.plot_width} x ${snapshot.plot_height} ft, ${snapshot.facing}-facing`,
    location: location || null,
  }
}

function reviewDetail(review: DemoReview): ReviewDetailDto {
  return {
    ...reviewSummary(review),
    snapshot: review.snapshot,
    comments: database()
      .review_comments.filter((c) => c.review_id === review.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(({ review_id: _review, author_id, ...comment }) => ({ ...comment, author: party(author_id) })),
  }
}

const isArchitect = (user: DemoUser) => user.role === 'architect'

function visibleReview(user: DemoUser, reviewId: string): DemoReview {
  const review = database().reviews.find((r) => r.id === reviewId)
  const visible =
    review &&
    (review.requester_id === user.id || (isArchitect(user) && (review.architect_id === user.id || review.status === 'queued')))
  return visible ? review : fail(404, 'Review not found')
}

function setProjectStatus(projectId: string, status: ProjectDto['status']) {
  const project = database().projects.find((p) => p.id === projectId)
  if (project) project.status = status
}

function reviewActivity(review: DemoReview, user: DemoUser, message: string) {
  database().activity.push({ id: createId(), project_id: review.project_id, user_id: user.id, message, created_at: now() })
}

function requestReview(user: DemoUser, project: DemoProject, body: Body): ReviewDetailDto {
  if (!database().rooms.some((r) => r.project_id === project.id)) fail(409, 'Add rooms to the plan before requesting a review.')
  if (database().reviews.some((r) => r.project_id === project.id && ACTIVE_REVIEW.includes(r.status))) {
    fail(409, 'This project already has a review in progress.')
  }
  const quote = reviewQuote()
  const timestamp = now()
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  const review: DemoReview = {
    id: createId(),
    project_id: project.id,
    requester_id: user.id,
    architect_id: null,
    status: 'awaiting_payment',
    outcome: null,
    customer_note: note || null,
    summary: null,
    snapshot: structuredClone(projectDetail(project)),
    fee: quote.fee,
    tax: quote.tax,
    total: quote.total,
    payment_reference: null,
    paid_at: null,
    due_at: null,
    claimed_at: null,
    completed_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  }
  database().reviews.push(review)
  addActivity(project, user, 'Architect review requested')
  return reviewDetail(review)
}

function reviewAction(user: DemoUser, review: DemoReview, action: string, body: Body): ReviewDetailDto {
  const timestamp = now()
  const isRequester = review.requester_id === user.id
  if (action === 'pay') {
    if (!isRequester) fail(403, 'Only the customer who requested the review can pay for it.')
    if (review.status !== 'awaiting_payment') fail(409, 'This review has already been paid for.')
    const due = new Date(Date.now() + REVIEW_TURNAROUND_DAYS * 86_400_000).toISOString()
    const reference = `SIM-${createId().replace(/-/g, '').slice(0, 8).toUpperCase()}`
    Object.assign(review, { status: 'queued', paid_at: timestamp, due_at: due, payment_reference: reference })
    setProjectStatus(review.project_id, 'in_review')
    reviewActivity(review, user, `Review fee of Rs ${review.total.toLocaleString('en-IN')} paid (simulated, ref ${reference})`)
  } else if (action === 'cancel') {
    if (!isRequester) fail(403, 'Only the customer who requested the review can cancel it.')
    if (review.status !== 'awaiting_payment' && review.status !== 'queued') {
      fail(409, "An architect has already started this review, so it can't be cancelled.")
    }
    review.status = 'cancelled'
    setProjectStatus(review.project_id, 'draft')
    reviewActivity(review, user, 'Architect review cancelled')
  } else if (action === 'claim') {
    if (!isArchitect(user)) fail(403, 'Only architects can take on reviews.')
    if (review.status !== 'queued') fail(409, "This review isn't waiting for an architect any more.")
    if (isRequester) fail(409, "You can't review your own project.")
    Object.assign(review, { status: 'in_review', architect_id: user.id, claimed_at: timestamp })
    reviewActivity(review, user, `${user.name} started the architect review`)
  } else if (action === 'comments') {
    if (review.architect_id !== user.id && !isRequester) fail(403, 'Take on the review before commenting.')
    if (review.status === 'awaiting_payment' || review.status === 'cancelled') fail(409, 'Comments open once the review is paid for.')
    const text = requireString(body, 'body', 'Write a comment.')
    if (text.length > 4000) fail(422, 'Keep comments under 4,000 characters.')
    const roomId = typeof body.room_id === 'string' && body.room_id ? body.room_id : null
    database().review_comments.push({
      id: createId(),
      review_id: review.id,
      author_id: user.id,
      body: text,
      room_id: roomId,
      created_at: timestamp,
    })
  } else if (action === 'complete') {
    if (review.architect_id !== user.id) fail(403, 'Only the architect reviewing this design can complete it.')
    if (review.status !== 'in_review') fail(409, "This review isn't in progress.")
    const outcome = body.outcome === 'approved' || body.outcome === 'changes_requested' ? body.outcome : fail(422, 'Choose an outcome.')
    const summary = requireString(body, 'summary', 'Write a summary for the customer.')
    Object.assign(review, { status: 'completed', outcome, summary, completed_at: timestamp })
    setProjectStatus(review.project_id, outcome === 'approved' ? 'ready' : 'draft')
    reviewActivity(review, user, `Architect review completed: ${outcome === 'approved' ? 'approved' : 'changes requested'}`)
  } else {
    fail(404, 'Not Found')
  }
  review.updated_at = timestamp
  return reviewDetail(review)
}

function reviewsRoute(method: HttpMethod, user: DemoUser, reviewId: string | undefined, action: string | undefined, body: Body) {
  if (reviewId === 'quote' && method === 'GET') return reviewQuote()
  if (!reviewId && method === 'GET') {
    return database()
      .reviews.filter((r) => (isArchitect(user) ? r.status === 'queued' || r.architect_id === user.id : r.requester_id === user.id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map(reviewSummary)
  }
  if (!reviewId) return fail(404, 'Not Found')
  const review = visibleReview(user, reviewId)
  if (!action && method === 'GET') return reviewDetail(review)
  if (action && method === 'POST') return reviewAction(user, review, action, body)
  return fail(404, 'Not Found')
}

// --- routing --------------------------------------------------------------------------------

function route(method: HttpMethod, segments: string[], body: Body, token: string | null): unknown {
  const [root, projectId, collection, itemId, action] = segments

  if (root === 'auth') {
    if (method === 'POST' && projectId === 'signup') return signup(body)
    if (method === 'POST' && projectId === 'login') return login(body)
    if (method === 'POST' && projectId === 'demo-provider') return providerSignIn(body)
    if (method === 'POST' && projectId === 'demo-reset-password') return resetPassword(body)
    if (method === 'GET' && projectId === 'me' && !collection) return publicUser(currentUser(token))
    if (method === 'GET' && projectId === 'me' && collection === 'export') return exportData(currentUser(token))
    if (method === 'DELETE' && projectId === 'me') return deleteAccount(currentUser(token), body)
    if (method === 'PATCH' && projectId === 'me' && !collection) {
      const user = currentUser(token)
      if (typeof body.email_notifications === 'boolean') user.email_notifications = body.email_notifications
      return publicUser(user)
    }
    if (method === 'POST' && projectId === 'change-password') return changePassword(currentUser(token), body)
    if (method === 'POST' && projectId === 'logout-all') {
      const user = currentUser(token)
      user.token_version = (user.token_version ?? 0) + 1
      return undefined
    }
  }

  if (root === 'reviews') return reviewsRoute(method, currentUser(token), projectId, collection, body)

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
        Object.assign(project, projectChanges(body), { updated_at: now() })
        return projectSummary(project)
      }
      if (method === 'DELETE') return deleteProject(project)
    }

    if (collection === 'layout' && method === 'PUT') return replaceLayout(user, project, body)

    if (collection === 'reviews') {
      if (method === 'GET') {
        return database()
          .reviews.filter((r) => r.project_id === project.id)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .map(reviewDetail)
      }
      if (method === 'POST') return requestReview(user, project, body)
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
  const [pathname, search = ''] = path.split('?')
  const segments = pathname.split('/').filter(Boolean)
  if (segments[0] === 'geo') {
    currentUser(token)
    return handleDemoGeo(segments, new URLSearchParams(search))
  }
  const result = route(method, segments, payload, token)
  if (method !== 'GET') persist()
  // Hand back copies, so callers can never mutate the stored records directly.
  return result === undefined ? undefined : structuredClone(result)
}
