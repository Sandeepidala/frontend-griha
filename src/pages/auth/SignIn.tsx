import { useState } from 'react'
import { Mail, Phone } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '@/components/layout/AuthLayout'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Divider } from '@/components/ui/Divider'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { AppleIcon, FacebookIcon, GoogleIcon } from '@/components/ui/icons/BrandIcons'
import { FormField } from '@/components/widgets/FormField'
import { OtpInput } from '@/components/widgets/OtpInput'
import { PasswordInput } from '@/components/widgets/PasswordInput'
import { SocialButton } from '@/components/widgets/SocialButton'
import { DEMO_EMAIL, DEMO_PASSWORD, useAuthStore } from '@/stores/useAuthStore'
import { toast } from '@/stores/useToastStore'

type Method = 'password' | 'phone'
type SocialProvider = 'google' | 'facebook' | 'apple'

export function SignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const status = useAuthStore((state) => state.status)
  const signInWithPassword = useAuthStore((state) => state.signInWithPassword)
  const signInWithProvider = useAuthStore((state) => state.signInWithProvider)
  const signInWithSso = useAuthStore((state) => state.signInWithSso)
  const requestOtp = useAuthStore((state) => state.requestOtp)
  const verifyOtp = useAuthStore((state) => state.verifyOtp)

  const [method, setMethod] = useState<Method>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [ssoOpen, setSsoOpen] = useState(false)
  const [workEmail, setWorkEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null)

  const isLoading = status === 'authenticating'
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  function goToDestination() {
    navigate(from, { replace: true })
    toast.success('Signed in — welcome back')
  }

  async function handlePasswordSignIn() {
    try {
      await signInWithPassword(email, password)
      goToDestination()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  async function handleSendOtp() {
    if (phone.trim().replace(/\D/g, '').length < 10) {
      setError('Enter a valid 10-digit mobile number.')
      return
    }
    await requestOtp(phone)
    setOtpSent(true)
    toast.info(`OTP sent to ${phone} — use 123456 for this demo`)
  }

  async function handleVerifyOtp() {
    try {
      await verifyOtp(phone, otp)
      goToDestination()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  async function handleSocial(provider: SocialProvider) {
    setSocialLoading(provider)
    try {
      await signInWithProvider(provider)
      goToDestination()
    } finally {
      setSocialLoading(null)
    }
  }

  async function handleSso() {
    if (!workEmail.includes('@')) {
      setError('Enter your work email to continue.')
      return
    }
    await signInWithSso(workEmail)
    navigate(from, { replace: true })
    toast.success('Signed in via your organization SSO')
  }

  return (
    <AuthLayout>
      <Alert open={!!error} onClose={() => setError(null)} variant="danger" title="Couldn't sign you in">
        {error}
      </Alert>

      <h1 className="font-display text-2xl font-bold text-text">Welcome back</h1>
      <p className="mt-1 text-sm text-text-muted">Sign in to continue designing your home.</p>

      <SegmentedControl
        value={method}
        onChange={(value) => {
          setMethod(value)
          setError(null)
        }}
        options={[
          { value: 'password', label: 'Email', icon: Mail },
          { value: 'phone', label: 'Phone', icon: Phone },
        ]}
        className="mt-4 grid w-full grid-cols-2"
      />

      {method === 'password' ? (
        <div className="mt-4 flex flex-col gap-3">
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text">Password</label>
              <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              className="mt-1.5"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          <label className="flex items-center gap-2.5 text-sm text-text">
            <Checkbox checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            Remember me
          </label>
          <Button isLoading={isLoading} onClick={handlePasswordSignIn} fullWidth>
            Sign in
          </Button>
          <p className="text-center text-xs text-text-faint">
            Demo account — {DEMO_EMAIL} / {DEMO_PASSWORD}
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {!otpSent ? (
            <>
              <FormField label="Mobile number" hint="We'll send a one-time code by SMS">
                <Input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="98765 43210"
                />
              </FormField>
              <Button isLoading={isLoading} onClick={handleSendOtp} fullWidth>
                Send OTP
              </Button>
            </>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium text-text">Enter the 6-digit code</p>
                <p className="text-xs text-text-muted">Sent to {phone} — use 123456 for this demo</p>
              </div>
              <OtpInput value={otp} onChange={setOtp} disabled={isLoading} />
              <Button isLoading={isLoading} disabled={otp.length < 6} onClick={handleVerifyOtp} fullWidth>
                Verify &amp; sign in
              </Button>
              <button
                type="button"
                onClick={() => {
                  setOtpSent(false)
                  setOtp('')
                }}
                className="text-center text-xs font-medium text-text-muted hover:text-text"
              >
                Use a different number
              </button>
            </>
          )}
        </div>
      )}

      <Divider label="or continue with" className="my-4" />

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

      {!ssoOpen ? (
        <button
          type="button"
          onClick={() => setSsoOpen(true)}
          className="mt-3 w-full text-center text-xs font-medium text-text-muted hover:text-text"
        >
          Sign in with company SSO
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-2.5 rounded-sm border border-border bg-surface-2 p-3">
          <FormField label="Work email">
            <Input
              type="email"
              value={workEmail}
              onChange={(event) => setWorkEmail(event.target.value)}
              placeholder="you@builderco.com"
            />
          </FormField>
          <Button variant="outline" size="sm" isLoading={isLoading} onClick={handleSso}>
            Continue with SSO
          </Button>
        </div>
      )}

      <p className="mt-4 text-center text-sm text-text-muted">
        Don't have an account?{' '}
        <Link to="/sign-up" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  )
}
