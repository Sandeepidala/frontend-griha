import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { SidePanel } from '@/components/ui/SidePanel'
import { Spinner } from '@/components/ui/Spinner'
import { ChatBubble } from './ChatBubble'
import { ChatComposer } from './ChatComposer'

type Message = { role: 'user' | 'assistant'; content: string; time: string }

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'assistant',
    content: "Hi! I'm your AI design assistant. Tell me about your plot, budget or room needs, and I'll help draft a layout.",
    time: 'Just now',
  },
]

function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function AiChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [isTyping, setIsTyping] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isTyping])

  function handleSend(content: string) {
    setMessages((prev) => [...prev, { role: 'user', content, time: now() }])
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Got it — I'll factor that in. Once you start a project I can generate layout options from this.",
          time: now(),
        },
      ])
    }, 1100)
  }

  return (
    <>
      <IconButton
        label={open ? 'Close AI design assistant' : 'Open AI design assistant'}
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
      >
        <Sparkles className="size-[18px]" />
      </IconButton>

      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="AI design assistant"
        description="Ask about your plot, budget or layout"
        footer={<ChatComposer onSend={handleSend} disabled={isTyping} />}
      >
        <div className="flex flex-col gap-4 px-5 py-4">
          {messages.map((message, i) => (
            <ChatBubble key={i} role={message.role} timestamp={message.time}>
              {message.content}
            </ChatBubble>
          ))}
          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Spinner size="sm" />
              Assistant is typing…
            </div>
          )}
          <div ref={endRef} />
        </div>
      </SidePanel>
    </>
  )
}
