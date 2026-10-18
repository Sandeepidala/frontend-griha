import { Suspense, lazy, useState } from 'react'
import { Clapperboard } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCostEstimate } from '@/hooks/useCostEstimate'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'

// The build animation (three.js) loads only when someone opens it.
const BuildSequenceDialog = lazy(() => import('@/components/canvas/BuildSequenceDialog').then((m) => ({ default: m.BuildSequenceDialog })))

/** The toolbar's "Watch it get built": plays the current plan's build sequence, and saves it as a video. */
export function BuildSequenceButton() {
  const plot = useDesignStore((state) => state.plot)
  const floors = useDesignStore((state) => state.floors)
  const projectId = useDesignStore((state) => state.projectId)
  const project = useProjectsStore((state) => state.projects.find((p) => p.id === projectId) ?? null)
  const estimate = useCostEstimate()
  const [open, setOpen] = useState(false)
  const hasRooms = floors.some((f) => f.rooms.length > 0)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={!hasRooms}
        title={hasRooms ? 'Watch this plan get built stage by stage, and download it as a video' : 'Add rooms to watch the plan get built'}
        className="shrink-0 gap-2"
      >
        <Clapperboard className="size-4" />
        <span className="hidden xl:inline">Watch it get built</span>
      </Button>
      {open && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <Spinner size="lg" />
            </div>
          }
        >
          <BuildSequenceDialog
            onClose={() => setOpen(false)}
            title={project?.name ?? 'Your plan'}
            projectName={project?.name ?? ''}
            plot={plot}
            floors={floors}
            brief={project?.brief ?? null}
            estimate={estimate}
          />
        </Suspense>
      )}
    </>
  )
}
