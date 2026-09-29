import type { ProjectBrief } from './brief'
import type { Floor, LengthUnit, Plot, Setbacks } from './design'

export type ProjectStatus = 'draft' | 'generating' | 'in_review' | 'ready'

export interface ProjectSummary {
  id: string
  name: string
  plotWidth: number
  plotHeight: number
  facing: Plot['facing']
  units: LengthUnit
  setbacks: Setbacks
  budget: number
  turnkey: boolean
  brief: ProjectBrief
  notes?: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}

/** Units and setbacks start at the backend's defaults and are set in the plan editor. */
export type NewProjectInput = Omit<ProjectSummary, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'units' | 'setbacks'>

/** What the brief wizard edits on an existing project. */
export type ProjectBriefUpdate = Pick<
  ProjectSummary,
  'name' | 'plotWidth' | 'plotHeight' | 'facing' | 'budget' | 'turnkey' | 'brief' | 'notes'
>

export interface ProjectDetail extends ProjectSummary {
  floors: Floor[]
}

export interface ActivityLogEntry {
  id: string
  message: string
  time: string
}
