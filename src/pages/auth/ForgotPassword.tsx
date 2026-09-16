import { useState } from 'react'
import { MailCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/widgets/FormField'
import { useAuthStore } from '@/stores/useAuthStore'

export function ForgotPassword() {
  const navigate = useNavigate()
  const status = useAuthStore((state) => state.status)
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset)

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  async function handleSubmit() {
    if (!email.includes('@')) return
    await requestPasswordReset(email)
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-sm bg-primary-soft text-primary">
            <MailCheck className="size-6" />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold text-text">Check your email</h1>
          <p className="mt-1.5 text-sm text-text-muted">
            If an account exists for <span className="font-medium text-text">{email}</span>, we've sent a link to
            reset your password.
          </p>
          <Button className="mt-6" fullWidth onClick={() => navigate('/reset-password')}>
            Open reset link (demo)
          </Button>
          <Link to="/sign-in" className="mt-4 text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <h1 className="font-display text-2xl font-bold text-text">Reset your password</h1>
      <p className="mt-1 text-sm text-text-muted">Enter your email and we'll send you a reset link.</p>

      <div className="mt-5 flex flex-col gap-4">
        <FormField label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </FormField>
        <Button isLoading={status === 'authenticating'} onClick={handleSubmit} fullWidth>
          Send reset link
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-text-muted">
        Remembered it?{' '}
        <Link to="/sign-in" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
