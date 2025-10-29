"use client"

import { ChatMessage } from '@/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RefreshCcw, Trash2 } from 'lucide-react'

interface MessageBubbleProps {
  message: ChatMessage
  onResend?: (message: ChatMessage) => void
  onDelete?: (message: ChatMessage) => void
  canDelete?: boolean
  className?: string
}

export function MessageBubble({
  message,
  onResend,
  onDelete,
  canDelete = false,
  className,
}: MessageBubbleProps) {
  const isCoach = message.sender === 'ai'
  const timestamp = message.timestamp instanceof Date
    ? message.timestamp
    : new Date(message.timestamp)

  return (
    <div
      className={cn(
        'flex flex-col space-y-2 max-w-3xl',
        isCoach ? 'items-start' : 'items-end',
        className
      )}
    >
      <div
        className={cn(
          'px-6 py-4 rounded-3xl shadow-lg text-sm whitespace-pre-wrap leading-relaxed',
          isCoach
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-bl-lg'
            : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-br-lg'
        )}
      >
        {isCoach && (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-1">
            Your Coach
          </p>
        )}
        <p>{message.content}</p>
      </div>

      <div
        className={cn(
          'flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400',
          isCoach ? 'flex-row' : 'flex-row-reverse space-x-reverse'
        )}
      >
        <span>
          {Number.isNaN(timestamp.getTime())
            ? ''
            : timestamp.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
        </span>

        {!isCoach && message.needsResend && onResend && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onResend(message)}
            disabled={message.isResending}
            className="text-xs px-2 py-1 h-6 bg-red-50 hover:bg-red-100 border-red-200 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:border-red-800 dark:text-red-400"
          >
            {message.isResending ? (
              <>Resending...</>
            ) : (
              <>
                <RefreshCcw className="h-3 w-3 mr-1" />
                Resend
                {message.resendCount && message.resendCount > 0 && (
                  <span className="ml-1 text-xs">({message.resendCount})</span>
                )}
              </>
            )}
          </Button>
        )}

        {!isCoach && canDelete && onDelete && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onDelete(message)}
            className="text-xs px-2 py-1 h-6 bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-600 dark:bg-gray-800/20 dark:hover:bg-gray-800/30 dark:border-gray-700 dark:text-gray-400"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Delete
          </Button>
        )}
      </div>
    </div>
  )
}

export default MessageBubble

