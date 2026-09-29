import { Download, KeyRound, LogOut, ShieldAlert, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { downloadBlob } from '@/components/drawings/exportSheets'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/widgets/FormField'
import { ApiError } from '@/lib/apiError'
import * as authApi from '@/lib/authApi'
import { useAuthStore } from '@/stores/useAuthStore'
import { toast } from '@/stores/useToastStore'

const MIN_PASSWORD_LENGTH = 8

function message(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback
}

function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`)
    if (next !== confirm) return setError("The new passwords don't match.")
    setError(null)
    setSaving(true)
    try {
      const user = await authApi.changePassword(current, next)
      useAuthStore.setState({ user })
      setCurrent('')
      setNext('')
      setConfirm('')
      toast.success('Password changed. Any other devices have been signed out.')
    } catch (err) {
      setError(message(err, "Couldn't change the password."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <FormField label="Current password">
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters`}>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </FormField>
        <FormField label="Confirm new password" error={error ?? undefined}>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </FormField>
      </div>
      <Button type="submit" size="sm" className="self-start" isLoading={saving} disabled={!current || !next || !confirm}>
        Change password
      </Button>
    </form>
  )
}

function DeleteAccount({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const signOut = useAuthStore((state) => state.signOut)
  const hasPassword = user?.provider === 'password'
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await authApi.deleteAccount(hasPassword ? { password: confirmation } : { confirmEmail: confirmation })
      signOut()
      navigate('/sign-in', { replace: true })
      toast.success('Your account and all its data have been deleted.')
    } catch (err) {
      setError(message(err, "Couldn't delete the account."))
      setDeleting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete your account?"
      description="This permanently deletes your account, every project and plan, your cost estimates and your architect review requests. It can't be undone."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={deleting} disabled={!confirmation}>
            Delete permanently
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-text-muted">Download your data first if you want a copy.</p>
      <FormField label={hasPassword ? 'Enter your password to confirm' : `Type ${user?.email || 'your email'} to confirm`} error={error ?? undefined}>
        <Input
          type={hasPassword ? 'password' : 'email'}
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete={hasPassword ? 'current-password' : 'off'}
        />
      </FormField>
    </Modal>
  )
}

/** Password, sessions and the customer's own data (project document §10: security and privacy). */
export function AccountSettings() {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const signOut = useAuthStore((state) => state.signOut)
  const [busy, setBusy] = useState<'logout' | 'export' | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function handleLogoutEverywhere() {
    setBusy('logout')
    try {
      await authApi.logoutEverywhere()
      signOut()
      navigate('/sign-in', { replace: true })
      toast.success('Signed out on every device.')
    } catch (err) {
      toast.danger(message(err, "Couldn't sign out everywhere."))
      setBusy(null)
    }
  }

  async function handleExport() {
    setBusy('export')
    try {
      const data = await authApi.exportMyData()
      downloadBlob(JSON.stringify(data, null, 2), 'application/json', `griha-my-data-${new Date().toISOString().slice(0, 10)}.json`)
      toast.success('Your data has been downloaded.')
    } catch (err) {
      toast.danger(message(err, "Couldn't export your data."))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-text-muted" />
            <div>
              <p className="font-medium text-text">Password</p>
              <p className="text-sm text-text-muted">
                {user?.provider === 'password'
                  ? 'Changing it signs you out on every other device.'
                  : "You sign in through a provider, so there's no password to change here."}
              </p>
            </div>
          </div>
          {user?.provider === 'password' && <ChangePassword />}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <LogOut className="mt-0.5 size-5 shrink-0 text-text-muted" />
            <div>
              <p className="font-medium text-text">Sign out everywhere</p>
              <p className="text-sm text-text-muted">Ends every session, including this one, e.g. if you used a shared computer.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogoutEverywhere} isLoading={busy === 'logout'}>
            Sign out everywhere
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-text-muted" />
            <div>
              <p className="font-medium text-text">Your data</p>
              <p className="text-sm text-text-muted">
                Your plot details, budget and designs are only used to design your home, travel encrypted (HTTPS) and are stored in an
                encrypted database. We don't share them with anyone without your consent; an architect sees a project only if you request
                a review.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" leftIcon={<Download className="size-4" />} onClick={handleExport} isLoading={busy === 'export'}>
              Download my data
            </Button>
            <Button variant="ghost" size="sm" className="text-danger" leftIcon={<Trash2 className="size-4" />} onClick={() => setDeleteOpen(true)}>
              Delete account
            </Button>
          </div>
        </CardBody>
      </Card>
      {deleteOpen && <DeleteAccount open={deleteOpen} onClose={() => setDeleteOpen(false)} />}
    </div>
  )
}
