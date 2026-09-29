import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar'
import { ModelViewer3D } from '@/components/canvas/ModelViewer3D'
import { PlanCanvas2D } from '@/components/canvas/PlanCanvas2D'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'

export function ProjectWorkspace() {
  const { id } = useParams<{ id: string }>()
  const viewMode = useDesignStore((state) => state.viewMode)
  const status = useDesignStore((state) => state.status)
  const error = useDesignStore((state) => state.error)
  const loadProject = useDesignStore((state) => state.loadProject)
  const setActiveProject = useProjectsStore((state) => state.setActiveProject)

  useEffect(() => {
    if (id) {
      setActiveProject(id)
      loadProject(id)
    }
  }, [id, setActiveProject, loadProject])

  return (
    <div className="flex h-svh flex-col">
      <Navbar />
      <CanvasToolbar />
      <div className="min-h-0 flex-1">
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
