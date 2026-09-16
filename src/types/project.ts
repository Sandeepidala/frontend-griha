import type { Plot } from './design'

export type CulturalPreference = 'hindu' | 'neutral' | 'muslim'
export type ProjectStatus = 'draft' | 'generating' | 'in_review' | 'ready'

export interface ProjectSummary {
  id: string
  name: string
  plotWidth: number
  plotHeight: number
  facing: Plot['facing']
  budget: number
  turnkey: boolean
  culturalPreference: CulturalPreference
  specialRooms: string[]
  notes?: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}

export type NewProjectInput = Omit<ProjectSummary, 'id' | 'status' | 'createdAt' | 'updatedAt'>

export interface ActivityLogEntry {
  id: string
  message: string
  time: string
}
