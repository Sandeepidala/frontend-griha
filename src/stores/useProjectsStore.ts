import { create } from 'zustand'
import { ApiError } from '@/lib/apiClient'
import * as projectsApi from '@/lib/projectsApi'
import type { ActivityLogEntry, NewProjectInput, ProjectBriefUpdate, ProjectSummary } from '@/types/project'
import type { DesignStyle } from '@/types/brief'
import { toast } from '@/stores/useToastStore'

/** The brief wizard either starts a new project or edits an existing project's brief. */
/** An edit opens on the Review step, or straight on `startAt` (e.g. to mark the plot on the map). */
export type BriefPanelState = { mode: 'edit'; projectId: string; startAt?: 'location' } | null

interface ProjectsState {
  projects: ProjectSummary[]
  activeProjectId: string | null
  activityLog: ActivityLogEntry[]
  status: 'idle' | 'loading' | 'error'
  error: string | null
  hasLoaded: boolean
  briefPanel: BriefPanelState
  fetchProjects: () => Promise<void>
  createProject: (input: NewProjectInput) => Promise<ProjectSummary>
  updateProjectBrief: (projectId: string, input: ProjectBriefUpdate) => Promise<ProjectSummary>
  /** Changes the house style and colour scheme at once on screen, then saves it (and puts it back if that fails). */
  setProjectStyle: (projectId: string, style: DesignStyle, palette: string | null) => Promise<boolean>
  setActiveProject: (id: string) => void
  openBriefEditor: (projectId: string, startAt?: 'location') => void
  closeBriefPanel: () => void
  reset: () => void
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Could not reach the server.'
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activityLog: [],
  status: 'idle',
  error: null,
  hasLoaded: false,
  briefPanel: null,

  fetchProjects: async () => {
    set({ status: 'loading', error: null })
    try {
      const projects = await projectsApi.listProjects()
      const activityLog = await projectsApi.listRecentActivity(projects.map((p) => p.id))
      set({ projects, activityLog, status: 'idle', hasLoaded: true })
    } catch (err) {
      set({ status: 'error', error: errorMessage(err), hasLoaded: true })
    }
  },

  createProject: async (input) => {
    const project = await projectsApi.createProject(input)
    set((state) => ({
      projects: [project, ...state.projects],
      activeProjectId: project.id,
    }))
    const activityLog = await projectsApi.listRecentActivity(get().projects.map((p) => p.id))
    set({ activityLog })
    return project
  },

  updateProjectBrief: async (projectId, input) => {
    const project = await projectsApi.updateProjectBrief(projectId, input)
    set((state) => ({ projects: state.projects.map((p) => (p.id === projectId ? project : p)) }))
    return project
  },

  setProjectStyle: async (projectId, style, palette) => {
    const before = get().projects.find((p) => p.id === projectId)
    if (!before) return false
    const restyled = { ...before, brief: { ...before.brief, style, palette } }
    set((state) => ({ projects: state.projects.map((p) => (p.id === projectId ? restyled : p)) }))
    try {
      const saved = await projectsApi.updateProjectBrief(projectId, restyled)
      // A quicker second change may have been made meanwhile; only the latest is kept on screen.
      set((state) => ({
        projects: state.projects.map((p) => (p.id === projectId && p.brief.style === style && p.brief.palette === palette ? saved : p)),
      }))
      return true
    } catch {
      set((state) => ({ projects: state.projects.map((p) => (p.id === projectId && p.brief.style === style && p.brief.palette === palette ? before : p)) }))
      toast.danger("Couldn't save the house style. Check your connection and try again.")
      return false
    }
  },

  setActiveProject: (id) => set({ activeProjectId: id }),
  openBriefEditor: (projectId, startAt) => set({ briefPanel: { mode: 'edit', projectId, startAt } }),
  closeBriefPanel: () => set({ briefPanel: null }),

  reset: () =>
    set({ projects: [], activeProjectId: null, activityLog: [], status: 'idle', error: null, hasLoaded: false }),
}))

export function useActiveProject() {
  return useProjectsStore((state) => state.projects.find((project) => project.id === state.activeProjectId) ?? null)
}
