"use client"

import { ChatMessage, SessionInsight } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import EmergencyResources from '@/components/EmergencyResources'
import { Lightbulb, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ContextPanelProps {
  messages: ChatMessage[]
  insights?: SessionInsight[]
  isLocked: boolean
  lockReason?: string | null
  showEmergencyResources: boolean
  onCloseEmergencyResources?: () => void
  onGenerateInsight?: () => void
  generatingInsight?: boolean
  className?: string
}

export function ContextPanel({
  messages,
  insights,
  isLocked,
  lockReason,
  showEmergencyResources,
  onCloseEmergencyResources,
  onGenerateInsight,
  generatingInsight,
  className,
}: ContextPanelProps) {
  const coachMessages = messages.filter(m => m.sender === 'ai')
  const latestInsights = (insights && insights.length > 0
    ? insights.slice(0, 3).map(insight => ({ id: insight.id, content: insight.insight_text }))
    : coachMessages
        .slice(-3)
        .reverse()
        .map((msg, index) => ({
          id: msg.id ?? `coach-${index}`,
          content: msg.content,
        })))

  return (
    <aside
      className={cn(
        'space-y-6 bg-white/70 dark:bg-slate-900/60 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm h-fit max-h-full overflow-y-auto',
        className
      )}
    >
      {showEmergencyResources ? (
        <Card className="border-none shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold text-red-600 dark:text-red-300 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Immediate support
            </CardTitle>
            {onCloseEmergencyResources && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCloseEmergencyResources}
                className="text-xs text-slate-500"
              >
                Close
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <EmergencyResources compact urgencyLevel="high" />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Session insights
              </CardTitle>
              {onGenerateInsight && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onGenerateInsight}
                  disabled={generatingInsight}
                >
                  {generatingInsight ? 'Generating…' : 'Generate insight'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {latestInsights.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Your coach&apos;s gentle guidance will appear here as the conversation unfolds.
              </p>
            ) : (
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                {latestInsights.map(item => (
                  <li
                    key={item.id}
                    className="rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 p-3"
                  >
                    {item.content}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-none shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Conversation status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between">
            <span>Total messages</span>
            <Badge variant="outline" className="bg-slate-50 dark:bg-slate-800/50">
              {messages.length}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Coach responses</span>
            <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200">
              {coachMessages.length}
            </Badge>
          </div>
          <div className="flex items-center justify_between">
            <span>Your messages</span>
            <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200">
              {messages.length - coachMessages.length}
            </Badge>
          </div>
          {isLocked && (
            <div className="mt-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300">
              <p className="font-semibold mb-1">Session locked</p>
              <p>{lockReason ? lockReason.replace(/_/g, ' ') : 'Secured by coach'}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </aside>
  )
}

export default ContextPanel

