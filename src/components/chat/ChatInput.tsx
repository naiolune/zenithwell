"use client"

import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChangeEvent, KeyboardEvent } from 'react'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  disabled?: boolean
  placeholder?: string
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  quickActions?: React.ReactNode
  className?: string
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  placeholder = 'Share your thoughts…',
  onKeyDown,
  quickActions,
  className,
}: ChatInputProps) {
  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value)
  }

  return (
    <div
      className={cn(
        'space-y-3 bg-white/80 dark:bg-slate-900/70 backdrop-blur border-t border-slate-200 dark:border-slate-800 p-4',
        className
      )}
    >
      {quickActions && <div>{quickActions}</div>}
      <div className="flex items-end space-x-3">
        <Textarea
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 min-h-[48px] max-h-40 resize-none rounded-2xl border border-slate-300/80 dark:border-slate-700/70 px-4 py-3 text-base leading-relaxed shadow-sm focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400"
        />
        <Button
          onClick={onSend}
          disabled={disabled || value.trim().length === 0}
          size="icon"
          className="h-11 w-11 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
        Press Enter to send • Shift + Enter for a new line
      </p>
    </div>
  )
}

export default ChatInput

