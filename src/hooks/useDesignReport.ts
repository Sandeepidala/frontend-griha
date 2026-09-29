import { useMemo } from 'react'
import { runDesignCheck, type DesignReport } from '@/lib/designCheck'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'

/** The live design check for the plan open in the editor; re-runs whenever the plan or brief changes. */
export function useDesignReport(): DesignReport {
  const plot = useDesignStore((state) => state.plot)
  const floors = useDesignStore((state) => state.floors)
  const projectId = useDesignStore((state) => state.projectId)
  const brief = useProjectsStore((state) => state.projects.find((p) => p.id === projectId)?.brief ?? null)
  return useMemo(() => runDesignCheck({ plot, floors, brief }), [plot, floors, brief])
}
