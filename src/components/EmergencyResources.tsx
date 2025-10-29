'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Phone, MessageSquare, Shield, Globe, HeartPulse } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmergencyResourcesProps {
  urgencyLevel?: 'high' | 'medium' | 'low'
  customMessage?: string
  compact?: boolean
  className?: string
}

const BASE_RESOURCES = [
  {
    name: 'National Suicide & Crisis Lifeline',
    number: '988',
    description: '24/7 free crisis support. Call, text, or chat 988.',
    icon: Phone,
    urgent: true,
  },
  {
    name: 'Crisis Text Line',
    number: 'Text HOME to 741741',
    description: 'Text with a trained crisis counselor anytime.',
    icon: MessageSquare,
    urgent: true,
  },
  {
    name: 'SAMHSA National Helpline',
    number: '1-800-662-4357',
    description: '24/7 confidential treatment referral and information.',
    icon: Phone,
    urgent: false,
  },
  {
    name: 'National Domestic Violence Hotline',
    number: '1-800-799-7233',
    description: 'Confidential support for those impacted by domestic violence.',
    icon: Shield,
    urgent: false,
  },
]

const INTERNATIONAL_RESOURCES = [
  { country: 'Canada', number: '1-833-456-4566', service: 'Crisis Services Canada' },
  { country: 'United Kingdom', number: '116 123', service: 'Samaritans' },
  { country: 'Australia', number: '13 11 14', service: 'Lifeline Australia' },
  { country: 'New Zealand', number: '0800 543 354', service: 'Lifeline New Zealand' },
]

export function EmergencyResources({
  urgencyLevel = 'high',
  customMessage,
  compact = false,
  className,
}: EmergencyResourcesProps) {
  const accentClass =
    urgencyLevel === 'high'
      ? 'from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 border-red-200 dark:border-red-800'
      : urgencyLevel === 'medium'
        ? 'from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border-amber-200 dark:border-amber-700'
        : 'from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800'

  return (
    <div
      className={cn(
        'space-y-4 rounded-3xl border p-4 shadow-sm bg-gradient-to-br',
        accentClass,
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            If you need immediate help
          </p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Crisis Support Resources
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {customMessage || 'You are not alone. Reach out to trained professionals who are ready to help.'}
          </p>
        </div>
        <Badge variant="outline" className="border-red-200 text-red-600 dark:border-red-700 dark:text-red-300">
          {urgencyLevel === 'high' ? 'High Priority' : urgencyLevel === 'medium' ? 'Helpful Support' : 'Community Care'}
        </Badge>
      </div>

      <div className="grid gap-3">
        {BASE_RESOURCES.map(resource => {
          const Icon = resource.icon
          return (
            <div
              key={resource.number}
              className="rounded-2xl border border-white/40 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/60 p-4 flex items-start gap-3"
            >
              <div className="mt-1 rounded-full bg-slate-100 dark:bg-slate-800 p-2">
                <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">{resource.name}</p>
                  {resource.urgent && (
                    <Badge variant="destructive" className="text-[10px] tracking-wide">
                      URGENT
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-sm text-slate-700 dark:text-slate-300">
                  {resource.number}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{resource.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      {!compact && (
        <div className="space-y-3 rounded-2xl border border-white/40 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <HeartPulse className="h-4 w-4 text-emerald-500" />
            International hotlines
          </div>
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            {INTERNATIONAL_RESOURCES.map(resource => (
              <div key={resource.country} className="flex items-center justify-between">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {resource.country}
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{resource.service}</span>
                </span>
                <span className="font-mono" aria-label={`Phone number ${resource.number}`}>
                  {resource.number}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!compact && (
        <div className="rounded-2xl border border-white/30 dark:border-slate-800/90 bg-white/50 dark:bg-slate-900/40 p-4 text-xs text-slate-500 dark:text-slate-400 space-y-2">
          <p className="font-semibold text-slate-700 dark:text-slate-200">In an emergency</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Call 911 (or your local emergency number) immediately.</li>
            <li>Stay with someone you trust until help arrives.</li>
            <li>Remove weapons, medications, or other potential dangers.</li>
          </ul>
        </div>
      )}

      {compact && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
          Need more support? Choose “Emergency resources” again for the full list.
        </p>
      )}
    </div>
  )
}

export default EmergencyResources
