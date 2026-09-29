import type { ProjectBrief } from '@/types/brief'
import type { Floor, Plot } from '@/types/design'

export type CheckStatus = 'pass' | 'warn' | 'fail'

export type CheckCategory = 'requirements' | 'space' | 'light' | 'privacy' | 'vastu' | 'site'

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  requirements: 'Brief match',
  space: 'Room sizes',
  light: 'Light & ventilation',
  privacy: 'Privacy',
  vastu: 'Vastu',
  site: 'Site & setbacks',
}

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
}
