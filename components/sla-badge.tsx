import * as React from 'react'
import { AlertTriangle, CheckCircle2, Clock, MinusCircle } from 'lucide-react'
import { cn, formatDuration } from '@/lib/utils'

export type SlaTone = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'MET' | 'NONE'

const toneStyles: Record<SlaTone, string> = {
  ON_TRACK:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800',
  AT_RISK:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800',
  BREACHED: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-800',
  MET: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  NONE: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
}

const toneIcons: Record<SlaTone, React.ComponentType<{ className?: string }>> = {
  ON_TRACK: Clock,
  AT_RISK: AlertTriangle,
  BREACHED: AlertTriangle,
  MET: CheckCircle2,
  NONE: MinusCircle,
}

export interface SlaCountdown {
  tone: SlaTone
  label: string
  /** Longer phrasing for the title attribute / screen readers. */
  detail: string
}

/**
 * Remaining time against a resolution deadline.
 *
 * Green above 4 hours, amber below 4 hours, red once past due — and the text
 * label always states the situation, so colour is never the only signal
 * (WCAG 1.4.1).
 */
export function slaCountdown(
  dueAt: Date | string | null | undefined,
  opts: {
    resolvedAt?: Date | string | null
    breached?: boolean
    now?: Date
  } = {}
): SlaCountdown {
  const now = opts.now ?? new Date()
  const due = dueAt ? (typeof dueAt === 'string' ? new Date(dueAt) : dueAt) : null
  const resolved = opts.resolvedAt
    ? typeof opts.resolvedAt === 'string'
      ? new Date(opts.resolvedAt)
      : opts.resolvedAt
    : null

  if (resolved) {
    const late = due ? resolved.getTime() > due.getTime() : false
    return late
      ? { tone: 'BREACHED', label: 'Resolved late', detail: 'Resolved after the SLA deadline' }
      : { tone: 'MET', label: 'SLA met', detail: 'Resolved within the SLA deadline' }
  }

  if (!due) {
    return { tone: 'NONE', label: 'No SLA', detail: 'No SLA deadline set for this ticket' }
  }

  const remainingMins = (due.getTime() - now.getTime()) / 60000

  if (remainingMins <= 0 || opts.breached) {
    const overdue = formatDuration(Math.abs(remainingMins))
    return {
      tone: 'BREACHED',
      label: `Overdue ${overdue}`,
      detail: `SLA breached — ${overdue} past the resolution deadline`,
    }
  }

  const left = formatDuration(remainingMins)
  return {
    tone: remainingMins < 240 ? 'AT_RISK' : 'ON_TRACK',
    label: `${left} left`,
    detail:
      remainingMins < 240
        ? `At risk — only ${left} until the resolution deadline`
        : `On track — ${left} until the resolution deadline`,
  }
}

export interface SlaBadgeProps {
  dueAt: Date | string | null | undefined
  resolvedAt?: Date | string | null
  breached?: boolean
  className?: string
}

export function SlaBadge({ dueAt, resolvedAt, breached, className }: SlaBadgeProps) {
  const { tone, label, detail } = slaCountdown(dueAt, { resolvedAt, breached })
  const Icon = toneIcons[tone]

  return (
    <span
      title={detail}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        toneStyles[tone],
        className
      )}
    >
      <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
      {label}
      <span className="sr-only"> — {detail}</span>
    </span>
  )
}
