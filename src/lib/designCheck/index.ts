import { buildContext } from './context'
import { lightChecks } from './rules/light'
import { privacyChecks } from './rules/privacy'
import { requirementChecks } from './rules/requirements'
import { siteChecks } from './rules/site'
import { spaceChecks } from './rules/space'
import { vastuChecks } from './rules/vastu'
import type { CategoryScore, CheckCategory, CheckResult, CheckStatus, DesignCheckInput, DesignReport } from './types'

export * from './types'

const STATUS_VALUE: Record<CheckStatus, number> = { pass: 1, warn: 0.5, fail: 0 }
const STATUS_ORDER: Record<CheckStatus, number> = { fail: 0, warn: 1, pass: 2 }
const CATEGORY_ORDER: CheckCategory[] = ['requirements', 'space', 'light', 'privacy', 'vastu', 'site']

/** Green from 80, amber from 60, red below. */
export function scoreVariant(score: number): 'success' | 'warning' | 'danger' {
  return score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger'
}

function scoreOf(results: CheckResult[]): number | null {
  const total = results.reduce((sum, r) => sum + (r.weight ?? 1), 0)
  if (total === 0) return null
  const earned = results.reduce((sum, r) => sum + (r.weight ?? 1) * STATUS_VALUE[r.status], 0)
  return Math.round((earned / total) * 100)
}

/**
 * The design optimisation rule-set (project document §8): one common set of checks, applied the
 * same way to every plan, whether drawn by hand or (later) generated. Pure and fast enough to run
 * on every edit.
 */
export function runDesignCheck(input: DesignCheckInput): DesignReport {
  const ctx = buildContext(input)
  const skipped: DesignReport['skipped'] = []
  if (!input.brief) skipped.push({ category: 'requirements', reason: 'No brief for this project yet.' })
  if (!input.brief?.vastu) {
    skipped.push({ category: 'vastu', reason: input.brief ? 'Vastu is turned off in the brief.' : 'No brief for this project yet.' })
  }
  if (ctx.allRooms.length === 0) {
    return { score: 0, categories: [], results: [], skipped: [...skipped, { category: 'site', reason: 'The plan has no rooms yet.' }] }
  }

  const byCategory: Record<CheckCategory, CheckResult[]> = {
    requirements: requirementChecks(ctx),
    space: spaceChecks(ctx),
    light: lightChecks(ctx),
    privacy: privacyChecks(ctx),
    vastu: input.brief?.vastu ? vastuChecks(ctx) : [],
    site: siteChecks(ctx),
  }

  const categories: CategoryScore[] = CATEGORY_ORDER.filter((category) => !skipped.some((s) => s.category === category)).map(
    (category) => ({
      category,
      score: scoreOf(byCategory[category]),
      results: [...byCategory[category]].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    }),
  )
  const scored = categories.filter((c) => c.score !== null)
  const score = scored.length ? Math.round(scored.reduce((sum, c) => sum + (c.score ?? 0), 0) / scored.length) : 0

  return {
    score,
    categories,
    results: categories.flatMap((c) => c.results),
    skipped,
  }
}
