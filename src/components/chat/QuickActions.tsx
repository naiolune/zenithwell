"use client"

import { Button } from '@/components/ui/button'
import { SquarePower } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickActionsProps {
  onEndSession?: () => void
  disabled?: boolean
  className?: string
}

export function QuickActions({
  onEndSession,
  disabled,
  className,
}: QuickActionsProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap gap-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 p-3',
        className
      )}
    >
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

