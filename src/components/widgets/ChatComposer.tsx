import { type FormEvent, useRef, useState } from 'react'
import { SendHorizontal } from 'lucide-react'
import { IconButton } from '@/components/ui/IconButton'
import { cn } from '@/lib/cn'

export interface ChatComposerProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function ChatComposer({
  onSend,
  disabled,
  placeholder = 'Describe your plot, budget, or ask for a change…',
  className,
}: ChatComposerProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function resize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    requestAnimationFrame(resize)
  }

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        submit()
      }}
      className={cn(
        'flex items-end gap-2 rounded-xl border border-border-strong bg-surface p-2',
        'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring',
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          setValue(event.target.value)
          resize()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
        className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-text outline-none placeholder:text-text-faint disabled:opacity-50"
      />
      <IconButton
        type="submit"
        label="Send message"
        variant="solid"
        disabled={disabled || !value.trim()}
      >
        <SendHorizontal className="size-[18px]" />
      </IconButton>
    </form>
  )
}
