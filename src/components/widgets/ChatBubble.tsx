import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'

export interface ChatBubbleProps {
  role: 'user' | 'assistant'
  children: ReactNode
  userName?: string
  timestamp?: string
  className?: string
}

export function ChatBubble({ role, children, userName = 'You', timestamp, className }: ChatBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex items-end gap-2.5', isUser && 'flex-row-reverse', className)}>
      {isUser ? (
        <Avatar name={userName} size="sm" />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Sparkles className="size-4" />
        </span>
      )}
      <div className={cn('flex max-w-[80%] flex-col gap-1', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-sm px-4 py-2.5 text-sm leading-relaxed break-words',
            isUser ? 'bg-primary text-on-primary' : 'border border-border bg-surface text-text',
          )}
        >
          {children}
        </div>
        {timestamp && <span className="px-1 text-[11px] text-text-faint">{timestamp}</span>}
      </div>
    </div>
  )
}
