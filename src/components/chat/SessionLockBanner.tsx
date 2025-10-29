"use client"

import { Button } from '@/components/ui/button'
import { Lock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SessionLockBannerProps {
  isLocked: boolean
  lockReason?: string | null
  isIntroductionLock?: boolean
  onStartFirstSession?: () => void
  supportEmail?: string
  className?: string
}

export function SessionLockBanner({
  isLocked,
  lockReason,
  isIntroductionLock = false,
  onStartFirstSession,
  supportEmail = 'support@zenithwell.com',
  className,
}: SessionLockBannerProps) {
  if (!isLocked) return null

  return (
    <div
      className={cn(
        'w-full border-t p-4',
        isIntroductionLock
          ? 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-700'
          : 'bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-700',
        className
      )}
    >
      <div className="max-w-4xl mx-auto text-center space-y-3">
        {isIntroductionLock ? (
          <>
            <div className="w-12 h-12 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-emerald-800 dark:text-emerald-200">
              Introduction session over
            </h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Beautiful start! Your goals are locked in—ready for your first full wellness conversation?
            </p>
            {onStartFirstSession && (
              <Button
                onClick={onStartFirstSession}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-2 rounded-full font-medium transition-all duration-200"
              >
                Start your first session
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-center space-x-2">
              <Lock className="h-5 w-5 text-red-600 dark:text-red-400" />
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
                Session secured
              </h3>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300">
              This session has been secured for your safety. Your coach has ended this session.
            </p>
            {lockReason && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Reason: {lockReason.replace(/_/g, ' ')}
              </p>
            )}
            {supportEmail && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Need help? Reach out at {supportEmail}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default SessionLockBanner

