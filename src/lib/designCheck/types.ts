import type { ProjectBrief } from '@/types/brief'
import type { Floor, Plot, Setbacks } from '@/types/design'
import type { SiteLocation } from '@/types/project'

export type CheckStatus = 'pass' | 'warn' | 'fail'

export type CheckCategory = 'requirements' | 'space' | 'light' | 'privacy' | 'vastu' | 'site' | 'budget' | 'compliance'

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  requirements: 'Brief match',
  space: 'Room sizes',
  light: 'Light & ventilation',
  privacy: 'Privacy',
  vastu: 'Vastu',
  site: 'Site & setbacks',
  budget: 'Budget',
  compliance: 'Bye-laws',
}

/** A change that fixes a result without help (lib/designCheck/fixes works out the details). */
export type FixAction =
  /**
   * Move the house inside the setback lines (raising the lines to `setbacks` first), trimming rooms if it
   * doesn't fit. Where it fits inside `prefer` (the bye-law setbacks) without trimming, it goes there.
   */
  | { kind: 'fit-setbacks'; setbacks?: Setbacks; prefer?: Setbacks }
  /** Trim one of two overlapping rooms so they only share a wall. */
  | { kind: 'separate'; floorId: string; roomIds: [string, string] }
  /** Grow a room into free space until it has this area (sq ft) and is this wide (ft) both ways. */
  | { kind: 'grow'; floorId: string; roomId: string; minArea: number; minWidth: number }

export interface CheckResult {
  /** Stable across re-runs for the same issue, so the UI can key and track it. */
  id: string
  category: CheckCategory
  status: CheckStatus
  title: string
  detail?: string
  /** Rooms the result is about, so the editor can select them. */
  roomIds?: string[]
  floorId?: string
  /** How much the result counts towards its category score (default 1). */
  weight?: number
  fix?: FixAction
}

export interface CategoryScore {
  category: CheckCategory
  /** 0–100, or null when the category has nothing to check. */
  score: number | null
  results: CheckResult[]
}

export interface DesignReport {
  /** 0–100 across the categories that were checked. */
  score: number
  categories: CategoryScore[]
  results: CheckResult[]
  /** Categories skipped entirely, e.g. Vastu when the brief turns it off. */
  skipped: { category: CheckCategory; reason: string }[]
}

export interface DesignCheckInput {
  plot: Plot
  floors: Floor[]
  /** Null when the project has no brief loaded yet: brief-match checks are skipped. */
  brief: ProjectBrief | null
  /** The cost estimate against the budget (from lib/boq); without it the budget check is skipped. */
  cost?: { estimate: number; budget: number; turnkey: boolean } | null
  /** Where the plot is and what was read about it (soil, road level, nearby features). */
  site?: SiteLocation | null
}
