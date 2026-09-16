import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Divider } from '@/components/ui/Divider'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { AppleIcon, FacebookIcon, GoogleIcon } from '@/components/ui/icons/BrandIcons'
import { FormField } from '@/components/widgets/FormField'
import { PasswordInput } from '@/components/widgets/PasswordInput'
import { PasswordStrengthMeter } from '@/components/widgets/PasswordStrengthMeter'
import { SocialButton } from '@/components/widgets/SocialButton'
import { useAuthStore } from '@/stores/useAuthStore'
import { toast } from '@/stores/useToastStore'
import type { AccountType } from '@/types/auth'

type SocialProvider = 'google' | 'facebook' | 'apple'

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'homeowner', label: 'Homeowner' },
  { value: 'builder', label: 'Builder' },
  { value: 'nri', label: 'NRI' },
]

export function SignUp() {
  const navigate = useNavigate()
  const status = useAuthStore((state) => state.status)
  const signUpWithPassword = useAuthStore((state) => state.signUpWithPassword)
  const signInWithProvider = useAuthStore((state) => state.signInWithProvider)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('homeowner')
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null)

  const isLoading = status === 'authenticating'

  async function handleSignUp() {
    if (!name.trim()) return setError('Enter your full name.')
    if (!email.includes('@')) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    if (!agreedToTerms) return setError('You need to accept the Terms and Privacy Policy to continue.')

    try {
      await signUpWithPassword({ name, email, password, accountType })
      navigate('/', { replace: true })
      toast.success('Account created — check your email to verify it')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  async function handleSocial(provider: SocialProvider) {
    setSocialLoading(provider)
    try {
      await signInWithProvider(provider)
      navigate('/', { replace: true })
      toast.success('Account created')
    } finally {
      setSocialLoading(null)
    }
  }

  return (
    <AuthLayout>
      <Alert open={!!error} onClose={() => setError(null)} variant="danger" title="Check your details">
        {error}
      </Alert>

      <h1 className="font-display text-2xl font-bold text-text">Create your account</h1>
      <p className="mt-1 text-sm text-text-muted">Design options, BOQ and CAD exports — free to start.</p>

      <div className="mt-3 flex flex-col gap-2.5">
        <FormField label="Full name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ananya Kapoor" autoComplete="name" />
        </FormField>

        <FormField label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </FormField>

        <div>
          <label className="text-sm font-medium text-text">Password</label>
          <PasswordInput
            className="mt-1.5"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <FormField label="Confirm password">
          <PasswordInput
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
          />
        </FormField>

        <div>
          <p className="mb-1.5 text-sm font-medium text-text">I am a...</p>
          <SegmentedControl
            value={accountType}
            onChange={setAccountType}
            options={ACCOUNT_TYPES}
            className="grid w-full grid-cols-3"
          />
        </div>

        <label className="flex items-start gap-2.5 text-sm text-text">
          <Checkbox
            checked={agreedToTerms}
            onChange={(event) => setAgreedToTerms(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            I agree to the <a href="#" className="text-primary hover:underline">Terms of Service</a> and{' '}
            <a href="#" className="text-primary hover:underline">Privacy Policy</a>
          </span>
        </label>

        <Button isLoading={isLoading} onClick={handleSignUp} fullWidth>
          Create account
        </Button>
      </div>

      <Divider label="or sign up with" className="my-4" />

      <div className="grid grid-cols-3 gap-2">
        <SocialButton
          variant="compact"
          icon={<GoogleIcon />}
          label="Google"
          isLoading={socialLoading === 'google'}
          disabled={!!socialLoading}
          onClick={() => handleSocial('google')}
        />
        <SocialButton
          variant="compact"
          icon={<FacebookIcon />}
          label="Facebook"
          isLoading={socialLoading === 'facebook'}
          disabled={!!socialLoading}
          onClick={() => handleSocial('facebook')}
        />
        <SocialButton
          variant="compact"
          icon={<AppleIcon />}
          label="Apple"
          isLoading={socialLoading === 'apple'}
          disabled={!!socialLoading}
          onClick={() => handleSocial('apple')}
        />
      </div>

      <p className="mt-4 text-center text-sm text-text-muted">
        Already have an account?{' '}
        <Link to="/sign-in" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
