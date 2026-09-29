import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/useAuthStore'
import { useProjectsStore } from '@/stores/useProjectsStore'

export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const hasLoaded = useProjectsStore((state) => state.hasLoaded)
  const fetchProjects = useProjectsStore((state) => state.fetchProjects)
  const location = useLocation()

  useEffect(() => {
    if (user && !hasLoaded) fetchProjects()
  }, [user, hasLoaded, fetchProjects])

  if (!user) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />
  }

  return children
}
