import * as React from 'react'
import { cn } from '@/lib/utils'

export type KpiTone = 'default' | 'info' | 'warning' | 'danger' | 'success'

/** Icon chip tints. Tone is redundant with the label — never the only signal. */
const toneChip: Record<KpiTone, string> = {
  default: 'bg-muted text-muted-foreground',
  info: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
}

export interface KpiTileProps {
  label: string
  value: string
  /** Small line under the number — trend, context or denominator. */
  context: string
  icon: React.ReactNode
  tone?: KpiTone
  /** Optional suffix rendered smaller beside the value, e.g. "/ 5". */
  unit?: string
}

export function KpiTile({ label, value, context, icon, tone = 'default', unit }: KpiTileProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
            toneChip[tone]
          )}
        >
          {icon}
        </span>
      </div>

      <p className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold leading-none tabular-nums tracking-tight text-foreground">
          {value}
        </span>
        {unit ? (
          <span className="text-sm font-medium text-muted-foreground">{unit}</span>
        ) : null}
      </p>

      <p className="text-xs leading-4 text-muted-foreground">{context}</p>
    </div>
  )
}
