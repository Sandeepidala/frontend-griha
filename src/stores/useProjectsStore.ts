import { create } from 'zustand'
import { ApiError } from '@/lib/apiClient'
import * as projectsApi from '@/lib/projectsApi'
import type { ActivityLogEntry, NewProjectInput, ProjectSummary } from '@/types/project'

interface ProjectsState {
  projects: ProjectSummary[]
  activeProjectId: string | null
  activityLog: ActivityLogEntry[]
  status: 'idle' | 'loading' | 'error'
  error: string | null
  hasLoaded: boolean
  newProjectPanelOpen: boolean
  fetchProjects: () => Promise<void>
  createProject: (input: NewProjectInput) => Promise<ProjectSummary>
  setActiveProject: (id: string) => void
  openNewProjectPanel: () => void
  closeNewProjectPanel: () => void
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
  newProjectPanelOpen: false,

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

  setActiveProject: (id) => set({ activeProjectId: id }),
  openNewProjectPanel: () => set({ newProjectPanelOpen: true }),
  closeNewProjectPanel: () => set({ newProjectPanelOpen: false }),

  reset: () =>
    set({ projects: [], activeProjectId: null, activityLog: [], status: 'idle', error: null, hasLoaded: false }),
}))

export function useActiveProject() {
  return useProjectsStore((state) => state.projects.find((project) => project.id === state.activeProjectId) ?? null)
}
