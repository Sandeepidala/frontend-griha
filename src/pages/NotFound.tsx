import { MapPinOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/widgets/EmptyState'

export function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-bg p-6">
      <EmptyState
        icon={MapPinOff}
        title="Page not found"
        description="The link may be old, or the project may have been deleted."
        action={
          <Link to="/">
            <Button>Go to projects</Button>
          </Link>
        }
        className="w-full max-w-lg border-none"
      />
    </div>
  )
}
