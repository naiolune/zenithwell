"use client"

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Heart, X } from 'lucide-react'

interface BreakPromptProps {
  visible: boolean
  onAccept: () => void
  onDismiss: () => void
  className?: string
}

export function BreakPrompt({ visible, onAccept, onDismiss, className }: BreakPromptProps) {
  if (!visible) return null

  return (
    <Card
      className={cn(
        'border-none bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 shadow-none',
        className
      )}
    >
      <CardHeader className="flex flex-row items-start justify_between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Heart className="h-4 w-4 text-rose-500" />
            Take a mindful pause
          </CardTitle>
          <CardDescription className="text-sm text-slate-600 dark:text-slate-300 mt-2">
            Your coach suggests a short breathing break to reset. Two minutes of calm can make a big difference.
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss} className="text-slate-500 hover:text-slate-700">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row gap-3">
        <Button
          onClick={onAccept}
          className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
        >
          Guide me through a 2-minute breathing reset
        </Button>
        <Button variant="outline" onClick={onDismiss}>
          Maybe later
        </Button>
      </CardContent>
    </Card>
  )
}

export default BreakPrompt

