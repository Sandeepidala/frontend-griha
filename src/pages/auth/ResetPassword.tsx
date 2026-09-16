import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { FormField } from '@/components/widgets/FormField'
import { PasswordInput } from '@/components/widgets/PasswordInput'
import { PasswordStrengthMeter } from '@/components/widgets/PasswordStrengthMeter'
import { useAuthStore } from '@/stores/useAuthStore'
import { toast } from '@/stores/useToastStore'

export function ResetPassword() {
  const navigate = useNavigate()
  const status = useAuthStore((state) => state.status)
  const resetPassword = useAuthStore((state) => state.resetPassword)

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')

    await resetPassword(password)
    toast.success('Password updated — sign in with your new password')
    navigate('/sign-in', { replace: true })
  }

  return (
    <AuthLayout>
      <Alert open={!!error} onClose={() => setError(null)} variant="danger" title="Check your details">
        {error}
      </Alert>

      <h1 className="font-display text-2xl font-bold text-text">Set a new password</h1>
      <p className="mt-1 text-sm text-text-muted">Choose a strong password you haven't used before.</p>

      <div className="mt-5 flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-text">New password</label>
          <PasswordInput
            className="mt-1.5"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <FormField label="Confirm new password">
          <PasswordInput
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
          />
        </FormField>

        <Button isLoading={status === 'authenticating'} onClick={handleSubmit} fullWidth>
          Update password
        </Button>
      </div>
    </AuthLayout>
  )
}
