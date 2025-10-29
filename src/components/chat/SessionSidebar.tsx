"use client"

import { ReactNode, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ArrowLeft, Clock, Flame, MessageCircle, Sparkles } from 'lucide-react'

interface MessageStats {
  total: number
  coachCount: number
  userCount: number
}

interface SessionSidebarProps {
  sessionTitle: string
  onBack?: () => void
  userSubscription: 'free' | 'pro'
  timeRemaining: number | null
  sessionEnded: boolean
  sessionStartTime: Date | null
  isIntroductionSession: boolean
  showCompleteIntroduction: boolean
  onCompleteIntroduction?: () => void
  completingIntroduction?: boolean
  quickActions?: ReactNode
  messageStats?: MessageStats
  introductionCompleted?: boolean
  className?: string
}

function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null) return '—'
  const minutes = Math.floor(milliseconds / 60000)
  const seconds = Math.floor((milliseconds % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function SessionSidebar({
  sessionTitle,
  onBack,
  userSubscription,
  timeRemaining,
  sessionEnded,
  sessionStartTime,
  isIntroductionSession,
  showCompleteIntroduction,
  onCompleteIntroduction,
  completingIntroduction,
  quickActions,
  messageStats,
  introductionCompleted = false,
  className,
}: SessionSidebarProps) {
  const formattedStartTime = useMemo(() => {
    if (!sessionStartTime) return '—'
    if (Number.isNaN(sessionStartTime.getTime())) return '—'
    return sessionStartTime.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }, [sessionStartTime])

  const stats = messageStats ?? { total: 0, coachCount: 0, userCount: 0 }

  return (
    <aside
      className={cn(
        'space-y-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm',
        className
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wide text-slate-400">Session</p>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {sessionTitle}
            </h2>
          </div>
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="rounded-full text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-3">
          <Badge variant="outline" className="capitalize">
            {userSubscription} plan
          </Badge>
          {sessionEnded && (
            <Badge variant="destructive">Ended</Badge>
          )}
        </div>
      </div>

      <Card className="border-none bg-white/80 dark:bg-slate-900/80 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            Session timing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between">
            <span>Started</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {formattedStartTime}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Time remaining</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {formatDuration(timeRemaining)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none bg-white/80 dark:bg-slate-900/80 shadow-none">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-500" />
            Conversation insights
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
            <p className="text-xs text-emerald-600 dark:text-emerald-300">Total</p>
            <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-200">
              {stats.total}
            </p>
          </div>
          <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 p-3 text-center">
            <p className="text-xs text-blue-600 dark:text-blue-300">You</p>
            <p className="text-lg font-semibold text-blue-700 dark:text-blue-200">
              {stats.userCount}
            </p>
          </div>
          <div className="rounded-2xl bg-purple-50 dark:bg-purple-900/20 p-3 text-center">
            <p className="text-xs text-purple-600 dark:text-purple-300">Coach</p>
            <p className="text-lg font-semibold text-purple-700 dark:text-purple-200">
              {stats.coachCount}
            </p>
          </div>
        </CardContent>
      </Card>

      {quickActions && (
        <Card className="border-none bg-white/80 dark:bg-slate-900/80 shadow-none">
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Quick actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">{quickActions}</CardContent>
        </Card>
      )}

      {isIntroductionSession && (
        <Card className="border-none bg-emerald-500/10 dark:bg-emerald-900/20 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-200 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {introductionCompleted ? 'Introduction completed' : 'Introduction ready'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-emerald-700 dark:text-emerald-200">
            {introductionCompleted ? (
              <>
                <p>Your goals are saved. You can start your first full wellness session anytime.</p>
                <Button disabled className="w-full cursor-default bg-emerald-500/40 text-white">
                  Introduction completed
                </Button>
              </>
            ) : showCompleteIntroduction && onCompleteIntroduction ? (
              <>
                <p>
                  You&apos;ve shared enough to set your goals. Lock in your introduction when you&apos;re ready.
                </p>
                <Button
                  onClick={onCompleteIntroduction}
                  disabled={completingIntroduction}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white"
                >
                  {completingIntroduction ? 'Completing...' : 'Complete introduction'}
                </Button>
              </>
            ) : (
              <p>Your coach will let you know when the introduction is ready to complete.</p>
            )}
          </CardContent>
        </Card>
      )}
    </aside>
  )
}

export default SessionSidebar

