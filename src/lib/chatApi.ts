import { apiRequest } from './apiClient'
import { mapRoom, type RoomDto } from './roomsApi'
import type { Room } from '@/types/design'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

/** A room the design assistant changed (and the server saved): before and after. */
export interface RoomChange {
  kind: 'added' | 'updated' | 'removed'
  floorId: string
  /** After the change; null for a removed room. */
  room: Room | null
  /** Before the change; null for an added room. */
  before: Room | null
}

/** What the editor tells the assistant along with a message (backend AssistantContext). */
export interface AssistantContextDto {
  design_check: {
    score: number
    categories: { label: string; score: number | null }[]
    results: {
      category: string
      status: 'pass' | 'warn' | 'fail'
      title: string
      detail: string | null
      weight: number
      room_ids: string[]
    }[]
    skipped: string[]
  } | null
  cost: { estimate: number; budget: number | null; includes_interiors: boolean; status: 'within' | 'close' | 'over' | null } | null
  active_floor_id: string | null
  selected_room_id: string | null
}

interface ChatMessageDto {
  id: string
  project_id: string | null
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface RoomChangeDto {
  kind: RoomChange['kind']
  room: RoomDto | null
  before: RoomDto | null
}

function mapMessage(dto: ChatMessageDto): ChatMessage {
  return { id: dto.id, role: dto.role, content: dto.content, createdAt: dto.created_at }
}

function mapChange(dto: RoomChangeDto): RoomChange {
  const floorId = (dto.room ?? dto.before)?.floor_id ?? ''
  return { kind: dto.kind, floorId, room: dto.room && mapRoom(dto.room), before: dto.before && mapRoom(dto.before) }
}

/** The conversation about one project, or the general one (no project), oldest first. */
export async function listMessages(projectId: string | null): Promise<ChatMessage[]> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
  const dtos = await apiRequest<ChatMessageDto[]>(`/chat/messages${query}`)
  return dtos.map(mapMessage)
}

/** Sends a message; the reply can take a while when the assistant changes the plan. */
export async function sendMessage(
  content: string,
  projectId: string | null,
  context: AssistantContextDto | null,
): Promise<{ messages: ChatMessage[]; changes: RoomChange[] }> {
  const result = await apiRequest<{ messages: ChatMessageDto[]; changes: RoomChangeDto[] }>('/chat/messages', {
    method: 'POST',
    body: { content, project_id: projectId, context },
  })
  return { messages: result.messages.map(mapMessage), changes: result.changes.map(mapChange) }
}

/** Whether the server has the AI assistant switched on (it needs an API key). */
export async function getAssistantStatus(): Promise<{ enabled: boolean; dailyLimit: number }> {
  const dto = await apiRequest<{ enabled: boolean; daily_limit: number }>('/chat/status')
  return { enabled: dto.enabled, dailyLimit: dto.daily_limit }
}
