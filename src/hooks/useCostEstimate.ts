import { useMemo } from 'react'
import { estimateBoq, type BoqEstimate } from '@/lib/boq'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'

/**
 * The live cost estimate for the plan open in the editor, against the project's budget.
 * `includeInteriors` overrides the budget's scope (e.g. to preview turnkey); omit it to follow the budget.
 */
export function useCostEstimate(includeInteriors?: boolean): BoqEstimate {
  const plot = useDesignStore((state) => state.plot)
  const floors = useDesignStore((state) => state.floors)
  const projectId = useDesignStore((state) => state.projectId)
  const project = useProjectsStore((state) => state.projects.find((p) => p.id === projectId) ?? null)
  const brief = project?.brief ?? null
  const budgetAmount = project?.budget
  const turnkey = project?.turnkey
  return useMemo(
    () =>
      estimateBoq({
        plot,
        floors,
        brief,
        budget: budgetAmount !== undefined && turnkey !== undefined ? { amount: budgetAmount, turnkey } : null,
        includeInteriors,
      }),
    [plot, floors, brief, budgetAmount, turnkey, includeInteriors],
  )
}
