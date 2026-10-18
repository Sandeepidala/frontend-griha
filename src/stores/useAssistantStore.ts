import { create } from 'zustand'
import { getAssistantStatus } from '@/lib/chatApi'
import { DEMO_MODE } from '@/lib/dataMode'

interface AssistantState {
  /** The AI assistant's panel is open. */
  open: boolean
  setOpen: (open: boolean) => void
  /** A message to send as soon as the panel is ready, e.g. from a design check "Ask AI" button. */
  queued: string | null
  /** Opens the panel and sends `message` to the assistant. */
  ask: (message: string) => void
  /** Hands over the queued message, once. */
  takeQueued: () => string | null
  /** Whether the server has the assistant switched on; null until known. */
  enabled: boolean | null
  checkEnabled: () => Promise<void>
}

export const useAssistantStore = create<AssistantState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  queued: null,
  ask: (message) => set({ open: true, queued: message }),
  takeQueued: () => {
    const { queued } = get()
    if (queued !== null) set({ queued: null })
    return queued
  },
  enabled: DEMO_MODE ? false : null,
  checkEnabled: async () => {
    if (get().enabled !== null) return
    try {
      set({ enabled: (await getAssistantStatus()).enabled })
    } catch {
      set({ enabled: false })
    }
  },
}))
