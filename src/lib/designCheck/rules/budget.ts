import type { CheckResult } from '../types'

/** Over budget by up to this much is a suggestion rather than a problem. */
const TOLERANCE = 0.1

function lakhs(amount: number) {
  return `₹${(amount / 1e5).toFixed(1)} L`
}

/** The cost-efficiency check (project document §8): does the plan's estimate stay within the budget? */
export function budgetChecks(cost: { estimate: number; budget: number; turnkey: boolean }): CheckResult[] {
  const scope = cost.turnkey ? 'turnkey' : 'construction-only'
  const over = cost.estimate - cost.budget
  const ratio = over / cost.budget
  if (over <= 0) {
    return [
      {
        id: 'budget-total',
        category: 'budget',
        status: 'pass',
        title: `Estimate ${lakhs(cost.estimate)} is within the ${lakhs(cost.budget)} ${scope} budget`,
        detail: `${lakhs(-over)} to spare.`,
        weight: 2,
      },
    ]
  }
  return [
    {
      id: 'budget-total',
      category: 'budget',
      status: ratio <= TOLERANCE ? 'warn' : 'fail',
      title: `Estimate ${lakhs(cost.estimate)} is ${Math.max(1, Math.round(ratio * 100))}% over the ${lakhs(cost.budget)} ${scope} budget`,
      detail:
        'See the cost estimate for the biggest items. Smaller rooms, fewer floors or simpler finishes (e.g. tiles instead of marble or wood) bring it down.',
      weight: 2,
    },
  ]
}
