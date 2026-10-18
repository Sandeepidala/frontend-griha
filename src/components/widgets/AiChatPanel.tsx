import { useEffect, useRef, useState } from 'react'
import { useMatch } from 'react-router-dom'
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { SidePanel } from '@/components/ui/SidePanel'
import { Spinner } from '@/components/ui/Spinner'
import { ApiError } from '@/lib/apiClient'
import { assistantContext, currentPlanReport } from '@/lib/assistantContext'
import { type ChatMessage, type RoomChange, listMessages, sendMessage } from '@/lib/chatApi'
import { DEMO_MODE } from '@/lib/dataMode'
import { formatLength } from '@/lib/units'
import { useAssistantStore } from '@/stores/useAssistantStore'
import { useAuthStore } from '@/stores/useAuthStore'
import { flushSaves, useDesignStore } from '@/stores/useDesignStore'
import { useProjectsStore } from '@/stores/useProjectsStore'
import { toast } from '@/stores/useToastStore'
import type { LengthUnit, Room } from '@/types/design'
import { ChatBubble } from './ChatBubble'
import { ChatComposer } from './ChatComposer'

/** What a reply did to the plan, kept while the panel is open so it can be undone. */
interface Outcome {
  changes: RoomChange[]
  scoreBefore: number
  scoreAfter: number
  state: 'applied' | 'undoing' | 'undone'
}

interface Entry extends ChatMessage {
  outcome?: Outcome
}

interface Conversation {
  /** The project's id, or "general" outside a project. */
  key: string
  entries: Entry[]
  failed?: string
}

const PROJECT_PROMPTS = ['What should I improve first?', 'Make the kitchen bigger', 'Add a pooja room in the north-east']
const GENERAL_PROMPTS = ['How big should a master bedroom be?', 'Where should the pooja room go in Vastu?', 'What do setbacks mean for my plot?']

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function errorText(err: unknown) {
  return err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.'
}

function size(room: Room, units: LengthUnit) {
  return `${formatLength(room.width, units)} × ${formatLength(room.height, units)}`
}

function describeChange(change: RoomChange, units: LengthUnit) {
  const { room, before } = change
  if (change.kind === 'added' && room) return `Added ${room.name} (${size(room, units)})`
  if (change.kind === 'removed' && before) return `Removed ${before.name}`
  if (!room || !before) return ''
  const parts: string[] = []
  if (room.name !== before.name) parts.push(`renamed from ${before.name}`)
  if (room.width !== before.width || room.height !== before.height) parts.push(`${size(before, units)} → ${size(room, units)}`)
  else if (room.x !== before.x || room.y !== before.y) parts.push('moved')
  if (room.type !== before.type && room.name === before.name) parts.push(`now a ${room.type} room`)
  return `${room.name}: ${parts.join(', ') || 'updated'}`
}

/** The changes a reply made, the score before and after, and undo for the latest. */
function OutcomeCard({ outcome, units, canUndo, onUndo }: { outcome: Outcome; units: LengthUnit; canUndo: boolean; onUndo: () => void }) {
  const delta = outcome.scoreAfter - outcome.scoreBefore
  return (
    <div className="ml-10.5 flex max-w-[80%] flex-col gap-2 rounded-sm border border-primary/30 bg-primary-soft/40 px-3 py-2.5 text-xs">
      <ul className="flex flex-col gap-1 text-text">
        {outcome.changes.map((change, i) => (
          <li key={i} className={outcome.state === 'undone' ? 'text-text-faint line-through' : undefined}>
            {describeChange(change, units)}
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-muted">
          {outcome.state === 'undone' ? (
            'Undone'
          ) : (
            <>
              Design score {outcome.scoreBefore} <ArrowRight className="inline size-3" /> {outcome.scoreAfter}
              {delta !== 0 && <span className={delta > 0 ? 'text-success' : 'text-danger'}> ({delta > 0 ? `+${delta}` : delta})</span>}
            </>
          )}
        </span>
        {canUndo && outcome.state !== 'undone' && (
          <Button size="sm" variant="ghost" onClick={onUndo} isLoading={outcome.state === 'undoing'} className="h-7 px-2">
            <RotateCcw className="size-3.5" /> Undo
          </Button>
        )}
      </div>
    </div>
  )
}

export function AiChatPanel() {
  const open = useAssistantStore((state) => state.open)
  const setOpen = useAssistantStore((state) => state.setOpen)
  const queued = useAssistantStore((state) => state.queued)
  // The assistant works on the project open in the editor; elsewhere it answers general questions.
  const match = useMatch('/projects/:id')
  const routeProjectId = match?.params.id && match.params.id !== 'new' ? match.params.id : null
  const loadedProjectId = useDesignStore((state) => state.projectId)
  const projectId = routeProjectId && routeProjectId === loadedProjectId ? routeProjectId : null
  const projectName = useProjectsStore((state) => state.projects.find((p) => p.id === projectId)?.name)
  const units = useDesignStore((state) => state.plot.units)
  const userName = useAuthStore((state) => state.user?.name)
  const key = projectId ?? 'general'

  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [pending, setPending] = useState<{ key: string; text: string } | null>(null)
  const [error, setError] = useState<{ key: string; message: string; text: string } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const current = conversation?.key === key ? conversation : null
  const entries = current?.entries ?? []
  const waiting = pending?.key === key ? pending : null
  const failure = error?.key === key ? error : null
  const lastWithChanges = [...entries].reverse().find((e) => e.outcome)?.id

  useEffect(() => {
    if (!open || DEMO_MODE || conversation?.key === key) return
    let cancelled = false
    listMessages(projectId)
      .then((messages) => !cancelled && setConversation({ key, entries: messages }))
      .catch((err) => !cancelled && setConversation({ key, entries: [], failed: errorText(err) }))
    return () => {
      cancelled = true
    }
  }, [open, key, projectId, conversation?.key])

  // A message from elsewhere in the app (Design check's "Ask AI") goes out once the conversation is loaded.
  useEffect(() => {
    if (!open || !current || pending || queued === null) return
    const message = useAssistantStore.getState().takeQueued()
    if (message) void send(message)
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries.length, waiting, failure, open])

  async function send(text: string) {
    if (pending) return
    const forKey = key
    const forProject = projectId
    setError(null)
    setPending({ key: forKey, text })
    try {
      // The server reads the saved plan, so edits still waiting to be saved go first.
      await flushSaves()
      const before = forProject ? assistantContext() : null
      const result = await sendMessage(text, forProject, before?.context ?? null)
      let outcome: Outcome | undefined
      if (result.changes.length > 0 && before && useDesignStore.getState().projectId === forProject) {
        useDesignStore.getState().applyRoomChanges(result.changes)
        outcome = { changes: result.changes, scoreBefore: before.score, scoreAfter: currentPlanReport().report.score, state: 'applied' }
      }
      const [asked, answered] = result.messages
      setConversation((prev) =>
        prev?.key === forKey ? { ...prev, entries: [...prev.entries, asked, { ...answered, outcome }] } : prev,
      )
    } catch (err) {
      setError({ key: forKey, message: errorText(err), text })
    } finally {
      setPending(null)
    }
  }

  function setOutcomeState(id: string, state: Outcome['state']) {
    setConversation((prev) =>
      prev && {
        ...prev,
        entries: prev.entries.map((e) => (e.id === id && e.outcome ? { ...e, outcome: { ...e.outcome, state } } : e)),
      },
    )
  }

  async function undo(entry: Entry) {
    if (!entry.outcome) return
    setOutcomeState(entry.id, 'undoing')
    const ok = await useDesignStore.getState().revertRoomChanges(entry.outcome.changes)
    setOutcomeState(entry.id, ok ? 'undone' : 'applied')
    if (ok) toast.success("Undid the assistant's changes.")
  }

  const prompts = projectId ? PROJECT_PROMPTS : GENERAL_PROMPTS
  const loading = open && !DEMO_MODE && !current

  return (
    <>
      <IconButton
        label={open ? 'Close AI design assistant' : 'Open AI design assistant'}
        variant="ghost"
        onClick={() => setOpen(!open)}
      >
        <Sparkles className="size-[18px]" />
      </IconButton>

      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="AI design assistant"
        description={projectName ? `Working on ${projectName}` : 'Ask about plots, room sizes, Vastu or budgets'}
        footer={
          <ChatComposer
            onSend={send}
            disabled={!!pending || DEMO_MODE}
            placeholder={projectId ? 'Ask anything, or ask for a change…' : 'Ask about planning your house…'}
          />
        }
      >
        <div className="flex flex-col gap-4 px-5 py-4">
          <ChatBubble role="assistant">
            {DEMO_MODE
              ? "The AI assistant needs Griha's server, so it isn't available in this offline demo."
              : projectId
                ? "Hi! I can see this project's plan, its design check and its cost. Ask me why the score is what it is, or ask for a change, like a bigger kitchen or a pooja room in the north-east, and I'll make it."
                : 'Hi! Open a project and I can explain its design check and change its rooms for you. Here, ask me anything about planning your house.'}
          </ChatBubble>

          {loading && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Spinner size="sm" /> Loading the conversation…
            </div>
          )}
          {current?.failed && <p className="text-xs text-danger">{current.failed}</p>}

          {current && entries.length === 0 && !waiting && !DEMO_MODE && (
            <div className="ml-10.5 flex flex-wrap gap-2">
              {prompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => send(prompt)}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text transition-colors hover:border-primary hover:text-primary"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {entries.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-2">
              <ChatBubble role={entry.role} userName={userName} timestamp={timeOf(entry.createdAt)}>
                <span className="whitespace-pre-wrap">{entry.content}</span>
              </ChatBubble>
              {entry.outcome && (
                <OutcomeCard outcome={entry.outcome} units={units} canUndo={entry.id === lastWithChanges} onUndo={() => undo(entry)} />
              )}
            </div>
          ))}

          {waiting && (
            <>
              <ChatBubble role="user" userName={userName}>
                <span className="whitespace-pre-wrap">{waiting.text}</span>
              </ChatBubble>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <Spinner size="sm" />
                {projectId ? 'Thinking about your plan… changes can take up to a minute.' : 'Thinking…'}
              </div>
            </>
          )}

          {failure && (
            <div className="flex flex-col items-start gap-2 rounded-sm border border-danger/30 bg-danger/5 px-3 py-2.5 text-xs">
              <p className="text-danger">{failure.message}</p>
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => send(failure.text)}>
                Try again
              </Button>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </SidePanel>
    </>
  )
}
