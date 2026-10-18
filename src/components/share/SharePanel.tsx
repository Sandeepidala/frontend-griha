import { useCallback, useEffect, useState } from 'react'
import { Copy, ExternalLink, MessageCircle, Plus, Share2, ShieldCheck, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { SidePanel } from '@/components/ui/SidePanel'
import { Spinner } from '@/components/ui/Spinner'
import { Switch } from '@/components/ui/Switch'
import { ApiError } from '@/lib/apiClient'
import { DEMO_MODE } from '@/lib/dataMode'
import {
  type ShareComment,
  type ShareLink,
  createShareLink,
  deleteShareComment,
  listProjectShareComments,
  listShareLinks,
  revokeShareLink,
  shareUrl,
} from '@/lib/sharesApi'
import { useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { toast } from '@/stores/useToastStore'

const seenKey = (projectId: string) => `griha-share-seen:${projectId}`

/** When the owner last read the comments on this project, from this browser. */
function lastSeen(projectId: string) {
  try {
    return localStorage.getItem(seenKey(projectId)) ?? ''
  } catch {
    return ''
  }
}

function markSeen(projectId: string, iso: string) {
  try {
    localStorage.setItem(seenKey(projectId), iso)
  } catch {
    /* storage unavailable: the badge comes back next visit */
  }
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback)

/** One link: copy it, send it on WhatsApp or the phone's share sheet, see who's looked, turn it off. */
function LinkRow({ link, projectName, onRevoke }: { link: ShareLink; projectName: string; onRevoke: () => Promise<void> }) {
  const url = shareUrl(link.token)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const message = `Here's the design for ${projectName} on Griha. Have a look and tell me what you think: ${url}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copied.')
    } catch {
      toast.danger("Couldn't copy. Select the link and copy it.")
    }
  }

  return (
    <li className="flex flex-col gap-2.5 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Share link" className="min-w-0 flex-1 rounded-sm border border-border bg-surface-2 px-2 py-1.5 font-mono text-xs text-text" />
        <IconButton label="Copy link" size="sm" variant="outline" onClick={copy}>
          <Copy className="size-4" />
        </IconButton>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" className="bg-[#1fa855] text-white hover:bg-[#1a9049]" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener')}>
          <MessageCircle className="size-4" /> WhatsApp
        </Button>
        {typeof navigator.share === 'function' && (
          <Button size="sm" variant="outline" onClick={() => navigator.share({ title: projectName, text: message, url }).catch(() => undefined)}>
            <Share2 className="size-4" /> Share…
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => window.open(url, '_blank', 'noopener')}>
          <ExternalLink className="size-4" /> Preview
        </Button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <span>
          Made {day(link.createdAt)} · {link.viewCount} {link.viewCount === 1 ? 'view' : 'views'}
          {link.allowComments ? ` · ${link.commentCount} ${link.commentCount === 1 ? 'comment' : 'comments'}` : ' · comments off'}
        </span>
        {confirming ? (
          <span className="flex items-center gap-1.5">
            <span className="text-text">Turn it off for everyone?</span>
            <Button
              size="sm"
              variant="danger"
              className="h-7 px-2"
              isLoading={busy}
              onClick={async () => {
                setBusy(true)
                await onRevoke()
                setBusy(false)
                setConfirming(false)
              }}
            >
              Turn off
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setConfirming(false)}>
              Keep
            </Button>
          </span>
        ) : (
          <button type="button" className="font-medium text-danger hover:underline" onClick={() => setConfirming(true)}>
            Turn off link
          </button>
        )}
      </div>
    </li>
  )
}

/** Sharing the project as a view-only link, and what people have said on it. */
export function SharePanel({ open, onClose, onSeen }: { open: boolean; onClose: () => void; onSeen: () => void }) {
  const projectId = useDesignStore((state) => state.projectId)
  const projectName = useProjectsStore((state) => state.projects.find((p) => p.id === projectId)?.name ?? 'my house')
  const [links, setLinks] = useState<ShareLink[] | null>(null)
  const [comments, setComments] = useState<ShareComment[]>([])
  const [allowComments, setAllowComments] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fresh each time the panel opens: views and comments change while it's closed.
  useEffect(() => {
    if (!open || !projectId) return
    let cancelled = false
    Promise.all([listShareLinks(projectId), listProjectShareComments(projectId)])
      .then(([l, c]) => {
        if (cancelled) return
        setLinks(l)
        setComments(c)
        setError(null)
        if (c[0]) markSeen(projectId, c[0].createdAt)
        onSeen()
      })
      .catch((err) => {
        if (cancelled) return
        setLinks([])
        setError(errorText(err, 'Could not load your links.'))
      })
    return () => {
      cancelled = true
    }
  }, [open, projectId, onSeen])

  async function create() {
    if (!projectId) return
    setCreating(true)
    try {
      const link = await createShareLink(projectId, allowComments)
      setLinks((prev) => [link, ...(prev ?? [])])
      try {
        await navigator.clipboard.writeText(shareUrl(link.token))
        toast.success('Link made and copied. Send it to your family.')
      } catch {
        toast.success('Link made. Copy it or send it on WhatsApp.')
      }
    } catch (err) {
      toast.danger(errorText(err, "Couldn't make a link."))
    } finally {
      setCreating(false)
    }
  }

  async function revoke(link: ShareLink) {
    if (!projectId) return
    try {
      await revokeShareLink(projectId, link.id)
      setLinks((prev) => (prev ?? []).filter((l) => l.id !== link.id))
      toast.success('Link turned off. It no longer opens.')
    } catch (err) {
      toast.danger(errorText(err, "Couldn't turn the link off."))
    }
  }

  async function removeComment(comment: ShareComment) {
    if (!projectId) return
    try {
      await deleteShareComment(projectId, comment.id)
      setComments((prev) => prev.filter((c) => c.id !== comment.id))
    } catch (err) {
      toast.danger(errorText(err, "Couldn't delete the comment."))
    }
  }

  return (
    <SidePanel open={open} onClose={onClose} title="Share with family" description="A view-only link to the plan, 3D, build video and cost. No account needed to open it." defaultWidth={460}>
      <div className="flex flex-col gap-5 px-5 py-4">
        <section className="flex flex-col gap-3">
          {links === null ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : (
            <>
              {links.length > 0 && (
                <ul className="flex flex-col gap-3">
                  {links.map((link) => (
                    <LinkRow key={link.id} link={link} projectName={projectName} onRevoke={() => revoke(link)} />
                  ))}
                </ul>
              )}
              <div className="flex flex-col gap-3 rounded-md border border-dashed border-border-strong p-3">
                <label className="flex items-center justify-between gap-3 text-sm text-text">
                  <span>
                    Let them comment
                    <span className="block text-xs text-text-muted">Their comments appear here and on the page</span>
                  </span>
                  <Switch checked={allowComments} onChange={(e) => setAllowComments(e.target.checked)} />
                </label>
                <Button onClick={create} isLoading={creating} className="self-start">
                  <Plus className="size-4" /> {links.length > 0 ? 'Make another link' : 'Make a link'}
                </Button>
                {links.length > 0 && <p className="text-xs text-text-faint">A separate link (say, one for the contractor) can be turned off on its own.</p>}
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
            </>
          )}
          <p className="flex gap-2 text-xs text-text-muted">
            <ShieldCheck className="mt-px size-4 shrink-0 text-success" />
            The page doesn't show your plot's address or map location, or your email, and nobody can change your design from it.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text">
            <MessageCircle className="size-4" /> What people said
            {comments.length > 0 && <Badge variant="neutral">{comments.length}</Badge>}
          </h3>
          {comments.length === 0 ? (
            <p className="text-sm text-text-muted">No comments yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {comments.map((c) => (
                <li key={c.id} className="group flex gap-2 rounded-md border border-border px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-semibold text-text">{c.authorName}</span>
                      <span className="text-text-faint">{when(c.createdAt)}</span>
                    </p>
                    <p className="mt-1 text-sm whitespace-pre-wrap text-text">{c.body}</p>
                  </div>
                  <IconButton label={`Delete ${c.authorName}'s comment`} size="sm" variant="ghost" onClick={() => removeComment(c)}>
                    <Trash2 className="size-4 text-text-faint" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </SidePanel>
  )
}

/** The toolbar's Share button, with a count of comments the owner hasn't read yet. */
export function ShareButton() {
  const projectId = useDesignStore((state) => state.projectId)
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)

  const refresh = useCallback(() => {
    if (!projectId) return
    const since = lastSeen(projectId)
    listProjectShareComments(projectId)
      .then((list) => setUnread(list.filter((c) => c.createdAt > since).length))
      .catch(() => setUnread(0))
  }, [projectId])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!projectId || DEMO_MODE) return null
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="relative shrink-0 gap-2" title="Share a view-only link with family or a contractor">
        <Share2 className="size-4" />
        <span className="sr-only 2xl:not-sr-only">Share</span>
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white" aria-label={`${unread} new comments`}>
            {unread}
          </span>
        )}
      </Button>
      <SharePanel open={open} onClose={() => setOpen(false)} onSeen={refresh} />
    </>
  )
}
