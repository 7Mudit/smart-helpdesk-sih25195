import * as React from 'react'
import { cn } from '@/lib/utils'

export type ProgressVariant = 'default' | 'success' | 'warning' | 'danger' | 'muted'

const progressFills: Record<ProgressVariant, string> = {
  default: 'bg-primary',
  success: 'bg-emerald-500 dark:bg-emerald-400',
  warning: 'bg-amber-500 dark:bg-amber-400',
  danger: 'bg-red-500 dark:bg-red-400',
  muted: 'bg-slate-400 dark:bg-slate-500',
}

export interface ProgressProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  value: number
  max?: number
  variant?: ProgressVariant
  /** Accessible name for the bar. */
  label?: string
}

export function Progress({
  value,
  max = 100,
  variant = 'default',
  label,
  className,
  ...props
}: ProgressProps) {
  const safeMax = max > 0 ? max : 100
  const pct = Math.min(100, Math.max(0, (value / safeMax) * 100))

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      {...props}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', progressFills[variant])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'MET'

const slaFills: Record<SlaState, string> = {
  ON_TRACK: 'bg-emerald-500 dark:bg-emerald-400',
  AT_RISK: 'bg-amber-500 dark:bg-amber-400',
  BREACHED: 'bg-red-500 dark:bg-red-400',
  MET: 'bg-slate-400 dark:bg-slate-500',
}

const slaLabels: Record<SlaState, string> = {
  ON_TRACK: 'On track',
  AT_RISK: 'At risk',
  BREACHED: 'Breached',
  MET: 'Met',
}

export interface SlaBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** 0–100; clamped. */
  percent: number
  state: SlaState
  /** Render the textual state beside the bar (colour is never the only signal). */
  showLabel?: boolean
}

export function SlaBar({ percent, state, showLabel = false, className, ...props }: SlaBarProps) {
  const pct = Math.min(100, Math.max(0, percent))
  const text = slaLabels[state]

  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`SLA ${text}`}
        className="h-1.5 min-w-[3rem] flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', slaFills[state])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel ? (
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{text}</span>
      ) : (
        <span className="sr-only">{text}</span>
      )}
    </div>
  )
}
