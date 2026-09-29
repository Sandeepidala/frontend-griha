import { create } from 'zustand'
import { ApiError } from '@/lib/apiClient'
import * as projectsApi from '@/lib/projectsApi'
import type { ActivityLogEntry, NewProjectInput, ProjectBriefUpdate, ProjectSummary } from '@/types/project'

/** The brief wizard either starts a new project or edits an existing project's brief. */
export type BriefPanelState = { mode: 'create' } | { mode: 'edit'; projectId: string } | null

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
  setActiveProject: (id: string) => void
  openNewProjectPanel: () => void
  openBriefEditor: (projectId: string) => void
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

  setActiveProject: (id) => set({ activeProjectId: id }),
  openNewProjectPanel: () => set({ briefPanel: { mode: 'create' } }),
  openBriefEditor: (projectId) => set({ briefPanel: { mode: 'edit', projectId } }),
  closeBriefPanel: () => set({ briefPanel: null }),

  reset: () =>
    set({ projects: [], activeProjectId: null, activityLog: [], status: 'idle', error: null, hasLoaded: false }),
}))

export function useActiveProject() {
  return useProjectsStore((state) => state.projects.find((project) => project.id === state.activeProjectId) ?? null)
}
