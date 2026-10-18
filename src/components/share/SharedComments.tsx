import { type FormEvent, useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { ApiError } from '@/lib/apiClient'
import { type ShareComment, addSharedComment, listSharedComments } from '@/lib/sharesApi'

const NAME_KEY = 'griha-share-name'

function readName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

function when(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** What everyone with the link has said, and a box to add to it (a name, no account needed). */
export function SharedComments({ token, allowComments, ownerFirstName }: { token: string; allowComments: boolean; ownerFirstName: string }) {
  const [comments, setComments] = useState<ShareComment[] | null>(null)
  const [name, setName] = useState(readName)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listSharedComments(token)
      .then((list) => !cancelled && setComments(list))
      .catch(() => !cancelled && setComments([]))
    return () => {
      cancelled = true
    }
  }, [token])

  async function send(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || !body.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const comment = await addSharedComment(token, name.trim(), body.trim())
      setComments((prev) => [...(prev ?? []), comment])
      setBody('')
      try {
        localStorage.setItem(NAME_KEY, name.trim())
      } catch {
        /* storage unavailable: the name is asked again next time */
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="flex items-center gap-2 font-display text-lg font-semibold text-text">
        <MessageCircle className="size-5" /> Comments
      </h2>
      {comments === null ? (
        <div className="h-16 animate-pulse rounded-md bg-surface-2" />
      ) : comments.length === 0 ? (
        <p className="text-sm text-text-muted">{allowComments ? `No comments yet. Tell ${ownerFirstName} what you think.` : 'No comments.'}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-surface px-3 py-2.5">
              <p className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-semibold text-text">{c.authorName}</span>
                <span className="text-text-faint">{when(c.createdAt)}</span>
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap text-text">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {allowComments ? (
        <form onSubmit={send} className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={60} aria-label="Your name" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={`Your thoughts for ${ownerFirstName}…`} maxLength={1000} rows={3} aria-label="Comment" />
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" size="sm" className="self-end" isLoading={sending} disabled={!name.trim() || !body.trim()}>
            <Send className="size-4" /> Send
          </Button>
        </form>
      ) : (
        <p className="text-xs text-text-faint">{ownerFirstName} has turned comments off for this link.</p>
      )}
    </section>
  )
}
