import { useMemo } from 'react'
import type { BoqEstimate } from '@/lib/boq'
import { runDesignCheck, type DesignReport } from '@/lib/designCheck'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'

/**
 * The live design check for the plan open in the editor; re-runs whenever the plan or brief changes.
 * Pass the cost estimate to include the budget check.
 */
export function useDesignReport(estimate?: BoqEstimate): DesignReport {
  const plot = useDesignStore((state) => state.plot)
  const floors = useDesignStore((state) => state.floors)
  const projectId = useDesignStore((state) => state.projectId)
  const brief = useProjectsStore((state) => state.projects.find((p) => p.id === projectId)?.brief ?? null)
  const total = estimate?.total
  const budget = estimate?.budget?.amount
  const turnkey = estimate?.includeInteriors ?? false
  return useMemo(
    () =>
      runDesignCheck({
        plot,
        floors,
        brief,
        cost: total !== undefined && budget !== undefined ? { estimate: total, budget, turnkey } : null,
      }),
    [plot, floors, brief, total, budget, turnkey],
  )
}
