import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from '@/components/RequireAuth'
import { SIMULATED_AUTH_AVAILABLE } from '@/lib/dataMode'
import { Toaster } from '@/components/ui/Toaster'
import { Dashboard } from '@/pages/Dashboard'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { SignIn } from '@/pages/auth/SignIn'
import { SignUp } from '@/pages/auth/SignUp'
import { ProjectWorkspace } from '@/pages/ProjectWorkspace'
import { ReviewWorkspace } from '@/pages/ReviewWorkspace'
import { Reviews } from '@/pages/Reviews'
import { Settings } from '@/pages/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        {/* Password reset is simulated (see lib/dataMode), so it only exists in demo mode. */}
        <Route
          path="/forgot-password"
          element={SIMULATED_AUTH_AVAILABLE ? <ForgotPassword /> : <Navigate to="/sign-in" replace />}
        />
        <Route
          path="/reset-password"
          element={SIMULATED_AUTH_AVAILABLE ? <ResetPassword /> : <Navigate to="/sign-in" replace />}
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <RequireAuth>
              <ProjectWorkspace />
            </RequireAuth>
          }
        />
        <Route
          path="/reviews"
          element={
            <RequireAuth>
              <Reviews />
            </RequireAuth>
          }
        />
        <Route
          path="/reviews/:id"
          element={
            <RequireAuth>
              <ReviewWorkspace />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
