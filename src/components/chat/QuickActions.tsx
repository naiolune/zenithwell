"use client"

import { Button } from '@/components/ui/button'
import { SquarePower, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickActionsProps {
  onEndSession?: () => void
  onRestartSession?: () => void
  disabled?: boolean
  className?: string
  showRestart?: boolean
}

export function QuickActions({
  onEndSession,
  onRestartSession,
  disabled,
  className,
  showRestart = false,
}: QuickActionsProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 p-3',
        className
      )}
    >
      {showRestart && onRestartSession && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onRestartSession}
          className="flex items-center gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Restart Session
        </Button>
      )}
      {onEndSession && (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={disabled}
          onClick={onEndSession}
          className="flex items-center gap-2"
        >
          <SquarePower className="h-4 w-4" />
          End session
        </Button>
      )}
    </div>
  )
}

export default QuickActions


