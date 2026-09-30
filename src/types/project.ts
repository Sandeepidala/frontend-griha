import type { ProjectBrief } from './brief'
import type { Floor, LengthUnit, Plot, Setbacks } from './design'

export interface LatLng {
  lat: number
  lng: number
}

/** Where the plot is: the searched address, the pin, and optionally the boundary drawn on the map. */
export interface SiteLocation {
  provider: 'google' | 'open' | 'manual'
  placeId: string | null
  formattedAddress: string | null
  lat: number
  lng: number
  country: string | null
  /** ISO 3166-1 alpha-2, e.g. "IN". */
  countryCode: string | null
  state: string | null
  city: string | null
  postcode: string | null
  locality: string | null
  /** The plot's corners, in order around it. */
  boundary: LatLng[] | null
  /** The side on the road: from corner `roadEdge` to the next. */
  roadEdge: number | null
  /** Degrees the plot is turned clockwise from its recorded facing. */
  rotationDeg: number | null
  /** Where the plan's north-west corner (x=0, y=0) is on the ground. */
  origin: LatLng | null
}

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
  site: SiteLocation | null
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
  'name' | 'plotWidth' | 'plotHeight' | 'facing' | 'budget' | 'turnkey' | 'brief' | 'site' | 'notes'
>

export interface ProjectDetail extends ProjectSummary {
  floors: Floor[]
}

export interface ActivityLogEntry {
  id: string
  message: string
  time: string
}
