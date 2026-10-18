import { apiRequest } from './apiClient'
import { type ProjectDetailDto, mapDetail } from './projectsApi'
import type { ProjectDetail } from '@/types/project'

/** A view-only link to a project. */
export interface ShareLink {
  id: string
  token: string
  allowComments: boolean
  viewCount: number
  lastViewedAt: string | null
  createdAt: string
  commentCount: number
}

export interface ShareComment {
  id: string
  shareLinkId: string
  authorName: string
  body: string
  createdAt: string
}

/** A project as a share link shows it (no address or exact location; the owner by first name). */
export interface SharedProject {
  project: ProjectDetail
  ownerFirstName: string
  allowComments: boolean
}

interface ShareLinkDto {
  id: string
  token: string
  allow_comments: boolean
  view_count: number
  last_viewed_at: string | null
  created_at: string
  comment_count: number
}

interface ShareCommentDto {
  id: string
  share_link_id: string
  author_name: string
  body: string
  created_at: string
}

type SharedProjectDto = Omit<ProjectDetailDto, 'id' | 'notes' | 'status' | 'created_at'> & { owner_first_name: string; allow_comments: boolean }

const mapLink = (dto: ShareLinkDto): ShareLink => ({
  id: dto.id,
  token: dto.token,
  allowComments: dto.allow_comments,
  viewCount: dto.view_count,
  lastViewedAt: dto.last_viewed_at,
  createdAt: dto.created_at,
  commentCount: dto.comment_count,
})

const mapComment = (dto: ShareCommentDto): ShareComment => ({
  id: dto.id,
  shareLinkId: dto.share_link_id,
  authorName: dto.author_name,
  body: dto.body,
  createdAt: dto.created_at,
})

/** The page a link opens, for this site. */
export function shareUrl(token: string) {
  return `${window.location.origin}/s/${token}`
}

// The owner's side.

export async function listShareLinks(projectId: string): Promise<ShareLink[]> {
  return (await apiRequest<ShareLinkDto[]>(`/projects/${projectId}/shares`)).map(mapLink)
}

export async function createShareLink(projectId: string, allowComments: boolean): Promise<ShareLink> {
  return mapLink(await apiRequest<ShareLinkDto>(`/projects/${projectId}/shares`, { method: 'POST', body: { allow_comments: allowComments } }))
}

export async function revokeShareLink(projectId: string, linkId: string): Promise<void> {
  await apiRequest(`/projects/${projectId}/shares/${linkId}`, { method: 'DELETE' })
}

/** Every comment left on the project's links, newest first. */
export async function listProjectShareComments(projectId: string): Promise<ShareComment[]> {
  return (await apiRequest<ShareCommentDto[]>(`/projects/${projectId}/share-comments`)).map(mapComment)
}

export async function deleteShareComment(projectId: string, commentId: string): Promise<void> {
  await apiRequest(`/projects/${projectId}/share-comments/${commentId}`, { method: 'DELETE' })
}

// Anyone with the link (no account).

export async function getSharedProject(token: string): Promise<SharedProject> {
  const dto = await apiRequest<SharedProjectDto>(`/shared/${encodeURIComponent(token)}`, { auth: false })
  const project = mapDetail({ ...dto, id: `shared-${token}`, notes: null, status: 'draft', created_at: dto.updated_at })
  return { project, ownerFirstName: dto.owner_first_name, allowComments: dto.allow_comments }
}

export async function listSharedComments(token: string): Promise<ShareComment[]> {
  return (await apiRequest<ShareCommentDto[]>(`/shared/${encodeURIComponent(token)}/comments`, { auth: false })).map(mapComment)
}

export async function addSharedComment(token: string, authorName: string, body: string): Promise<ShareComment> {
  return mapComment(
    await apiRequest<ShareCommentDto>(`/shared/${encodeURIComponent(token)}/comments`, { method: 'POST', auth: false, body: { author_name: authorName, body } }),
  )
}
