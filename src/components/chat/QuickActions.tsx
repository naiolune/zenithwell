"use client"

import { Button } from '@/components/ui/button'
import { HeartHandshake, ShieldHalf, SquarePower, Sparkles, BookmarkPlus, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuickActionsProps {
  onSuggestBreak?: () => void
  onOpenEmergencyResources?: () => void
  onEndSession?: () => void
  onAddCoachNote?: () => void
  onScheduleCheckIn?: () => void
  onAddMemoryTag?: () => void
  disabled?: boolean
  className?: string
}

export function QuickActions({
  onSuggestBreak,
  onOpenEmergencyResources,
  onEndSession,
  onAddCoachNote,
  onScheduleCheckIn,
  onAddMemoryTag,
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
      {onSuggestBreak && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onSuggestBreak}
          className="flex items-center gap-2"
        >
          <HeartHandshake className="h-4 w-4 text-rose-500" />
          Suggest a break
        </Button>
      )}

      {onOpenEmergencyResources && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onOpenEmergencyResources}
          className="flex items-center gap-2"
        >
          <ShieldHalf className="h-4 w-4 text-red-500" />
          Emergency resources
        </Button>
      )}

      {onAddCoachNote && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onAddCoachNote}
          className="flex items-center gap-2"
        >
          <BookmarkPlus className="h-4 w-4 text-indigo-500" />
          Add session note
        </Button>
      )}

      {onAddMemoryTag && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onAddMemoryTag}
          className="flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4 text-amber-500" />
          Tag a memory
        </Button>
      )}

      {onScheduleCheckIn && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={onScheduleCheckIn}
          className="flex items-center gap-2"
        >
          <Calendar className="h-4 w-4 text-emerald-500" />
          Schedule check-in
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

