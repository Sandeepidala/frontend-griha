import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar'
import { CostEstimatePanel } from '@/components/canvas/CostEstimatePanel'
import { DesignCheckPanel } from '@/components/canvas/DesignCheckPanel'
import { GeneratePanel } from '@/components/canvas/GeneratePanel'
import { DrawingsWorkspace } from '@/components/drawings/DrawingsWorkspace'
import { ModelViewer3D } from '@/components/canvas/ModelViewer3D'
import { PlanCanvas2D } from '@/components/canvas/PlanCanvas2D'
import { ReviewPanel } from '@/components/canvas/ReviewPanel'
import { SelectionToolbar } from '@/components/canvas/SelectionToolbar'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCostEstimate } from '@/hooks/useCostEstimate'
import { useDesignReport } from '@/hooks/useDesignReport'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'
import type { Review } from '@/types/review'

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>()
  const viewMode = useDesignStore((state) => state.viewMode)
  const status = useDesignStore((state) => state.status)
  const error = useDesignStore((state) => state.error)
  const loadProject = useDesignStore((state) => state.loadProject)
  const setActiveProject = useProjectsStore((state) => state.setActiveProject)
  const costEstimate = useCostEstimate()
  const designReport = useDesignReport(costEstimate)
  const [designCheckOpen, setDesignCheckOpen] = useState(false)
  const [costEstimateOpen, setCostEstimateOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [latestReview, setLatestReview] = useState<Review | null>(null)
  const planIsEmpty = useDesignStore((state) => state.floors.every((f) => f.rooms.length === 0))

  useEffect(() => {
    if (id) {
      setActiveProject(id)
      loadProject(id)
    }
  }, [id, setActiveProject, loadProject])

  return (
    <div className="flex h-svh flex-col">
      <Navbar />
      <CanvasToolbar
        designReport={status === 'idle' ? designReport : undefined}
        onOpenDesignCheck={() => setDesignCheckOpen(true)}
        costEstimate={status === 'idle' ? costEstimate : undefined}
        onOpenCostEstimate={() => setCostEstimateOpen(true)}
        onOpenGenerate={() => setGenerateOpen(true)}
        onOpenReview={() => setReviewOpen(true)}
        review={latestReview}
      />
      <GeneratePanel open={generateOpen} onClose={() => setGenerateOpen(false)} />
      <DesignCheckPanel open={designCheckOpen} onClose={() => setDesignCheckOpen(false)} report={designReport} />
      <CostEstimatePanel open={costEstimateOpen} onClose={() => setCostEstimateOpen(false)} />
      {status === 'idle' && <ReviewPanel key={id} open={reviewOpen} onClose={() => setReviewOpen(false)} onChange={setLatestReview} />}
      {status === 'idle' && viewMode !== 'drawings' && <SelectionToolbar />}
      <div className="relative min-h-0 flex-1">
        {status === 'idle' && planIsEmpty && viewMode !== 'drawings' && (
          // A new project starts empty: offer to generate a plan from the brief.
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-5 text-center shadow-md">
              <Sparkles className="size-6 text-primary" />
              <p className="font-display font-semibold text-text">Start from your brief</p>
              <p className="text-sm text-text-muted">
                Generate layout options for this plot, each checked against your brief and budget, or draw your own
                with Add room.
              </p>
              <Button onClick={() => setGenerateOpen(true)} className="gap-2">
                <Sparkles className="size-4" />
                Generate layout options
              </Button>
            </div>
          </div>
        )}
        {status === 'loading' ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : status === 'error' ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-sm text-text-muted">{error}</p>
            <Button onClick={() => id && loadProject(id)}>Try again</Button>
          </div>
        ) : (
          <>
            {viewMode === '2d' && <PlanCanvas2D />}
            {viewMode === '3d' && <ModelViewer3D />}
            {viewMode === 'drawings' && <DrawingsWorkspace />}
            {viewMode === 'split' && (
              <div className="flex h-full flex-col md:flex-row">
                <div className="min-h-0 min-w-0 flex-1 border-b border-border md:border-r md:border-b-0">
                  <PlanCanvas2D />
                </div>
                <div className="min-h-0 min-w-0 flex-1">
                  <ModelViewer3D />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
