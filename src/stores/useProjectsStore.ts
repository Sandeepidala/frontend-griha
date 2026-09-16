import { create } from 'zustand'
import type { ActivityLogEntry, NewProjectInput, ProjectSummary } from '@/types/project'

const SEED_PROJECTS: ProjectSummary[] = [
  {
    id: 'demo',
    name: 'Sharma Residence',
    plotWidth: 30,
    plotHeight: 40,
    facing: 'north',
    budget: 4500000,
    turnkey: false,
    culturalPreference: 'hindu',
    specialRooms: ['Pooja / prayer room', 'Store room'],
    status: 'ready',
    createdAt: '2026-09-02T09:00:00.000Z',
    updatedAt: '2026-09-14T15:30:00.000Z',
  },
  {
    id: 'reddy-villa',
    name: 'Reddy Villa',
    plotWidth: 40,
    plotHeight: 60,
    facing: 'east',
    budget: 8500000,
    turnkey: true,
    culturalPreference: 'neutral',
    specialRooms: ['Home office'],
    status: 'in_review',
    createdAt: '2026-08-20T09:00:00.000Z',
    updatedAt: '2026-09-13T11:10:00.000Z',
  },
  {
    id: 'iyer-farmhouse',
    name: 'Iyer Farmhouse',
    plotWidth: 50,
    plotHeight: 80,
    facing: 'south',
    budget: 12000000,
    turnkey: false,
    culturalPreference: 'hindu',
    specialRooms: ['Pooja / prayer room', 'Servant quarters'],
    status: 'draft',
    createdAt: '2026-09-10T09:00:00.000Z',
    updatedAt: '2026-09-10T09:00:00.000Z',
  },
]

const SEED_ACTIVITY: ActivityLogEntry[] = [
  { id: 'a1', message: 'Design generated for Sharma Residence — Vastu score 82%', time: '2 hours ago' },
  { id: 'a2', message: 'Architect review requested for Reddy Villa', time: 'Yesterday' },
  { id: 'a3', message: 'New project created: Iyer Farmhouse', time: '3 days ago' },
  { id: 'a4', message: 'BOQ exported for Sharma Residence (PDF)', time: '4 days ago' },
]

interface ProjectsState {
  projects: ProjectSummary[]
  activeProjectId: string | null
  activityLog: ActivityLogEntry[]
  newProjectPanelOpen: boolean
  createProject: (input: NewProjectInput) => ProjectSummary
  setActiveProject: (id: string) => void
  openNewProjectPanel: () => void
  closeNewProjectPanel: () => void
}

export const useProjectsStore = create<ProjectsState>((set) => ({
  projects: SEED_PROJECTS,
  activeProjectId: null,
  activityLog: SEED_ACTIVITY,
  newProjectPanelOpen: false,

  createProject: (input) => {
    const now = new Date().toISOString()
    const project: ProjectSummary = {
      ...input,
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `project-${Date.now()}`,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }
    set((state) => ({
      projects: [project, ...state.projects],
      activeProjectId: project.id,
      activityLog: [
        { id: `log-${project.id}`, message: `New project created: ${project.name}`, time: 'Just now' },
        ...state.activityLog,
      ],
    }))
    return project
  },

  setActiveProject: (id) => set({ activeProjectId: id }),
  openNewProjectPanel: () => set({ newProjectPanelOpen: true }),
  closeNewProjectPanel: () => set({ newProjectPanelOpen: false }),
}))

export function useActiveProject() {
  return useProjectsStore((state) => state.projects.find((project) => project.id === state.activeProjectId) ?? null)
}
