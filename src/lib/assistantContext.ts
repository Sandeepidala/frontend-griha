import { estimateBoq } from '@/lib/boq'
import type { AssistantContextDto } from '@/lib/chatApi'
import { CATEGORY_LABELS, runDesignCheck } from '@/lib/designCheck'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'
import type { Floor, Plot } from '@/types/design'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const isUuid = (id: string | null | undefined): id is string => !!id && UUID.test(id)

/**
 * The open plan's cost estimate and design check, worked out as the editor does (hooks/useDesignReport);
 * pass a changed plot and floors to see what a change would do.
 */
export function currentPlanReport(changed?: { plot: Plot; floors: Floor[] }) {
  const state = useDesignStore.getState()
  const { plot, floors } = changed ?? state
  const { projectId } = state
  const project = useProjectsStore.getState().projects.find((p) => p.id === projectId) ?? null
  const brief = project?.brief ?? null
  const site = project?.site ?? null
  const estimate = estimateBoq({ plot, floors, brief, budget: project ? { amount: project.budget, turnkey: project.turnkey } : null, site })
  const report = runDesignCheck({
    plot,
    floors,
    brief,
    cost: estimate.budget ? { estimate: estimate.total, budget: estimate.budget.amount, turnkey: estimate.includeInteriors } : null,
    site,
  })
  return { estimate, report }
}

/** What the design assistant is told about the open plan beyond what the server has saved. */
export function assistantContext(): { context: AssistantContextDto; score: number } {
  const { activeFloorId, selection } = useDesignStore.getState()
  const { estimate, report } = currentPlanReport()
  const clip = (text: string, length: number) => (text.length > length ? `${text.slice(0, length - 1)}…` : text)
  return {
    score: report.score,
    context: {
      design_check: {
        score: report.score,
        categories: report.categories.map((c) => ({ label: CATEGORY_LABELS[c.category], score: c.score })),
        results: report.results.slice(0, 150).map((r) => ({
          category: CATEGORY_LABELS[r.category],
          status: r.status,
          title: clip(r.title, 300),
          detail: r.detail ? clip(r.detail, 600) : null,
          weight: Math.min(10, Math.max(0, r.weight ?? 1)),
          room_ids: (r.roomIds ?? []).filter(isUuid).slice(0, 20),
        })),
        skipped: report.skipped.slice(0, 12).map((s) => clip(`${CATEGORY_LABELS[s.category]}: ${s.reason}`, 200)),
      },
      cost: {
        estimate: estimate.total,
        budget: estimate.budget?.amount ?? null,
        includes_interiors: estimate.includeInteriors,
        status: estimate.budget?.status ?? null,
      },
      active_floor_id: isUuid(activeFloorId) ? activeFloorId : null,
      selected_room_id: selection?.type === 'room' && isUuid(selection.id) ? selection.id : null,
    },
  }
}
