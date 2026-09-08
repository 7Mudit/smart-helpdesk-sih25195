import * as React from 'react'
import { LABELS, type Priority, type Status } from '@/lib/constants'
import { cn, priorityStyles, statusStyles } from '@/lib/utils'

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'danger'

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-primary/10 text-primary ring-primary/20 dark:bg-primary/20',
  secondary: 'bg-secondary text-secondary-foreground ring-border',
  outline: 'bg-transparent text-foreground ring-border',
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800',
  warning:
    'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800',
  danger:
    'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-800',
}

const badgeBase =
  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant = 'default', ...props },
  ref
) {
  return <span ref={ref} className={cn(badgeBase, badgeVariants[variant], className)} {...props} />
})

/** Colour of the leading dot. Colour is decorative only — the text label carries the meaning. */
const priorityDot: Record<Priority, string> = {
  LOW: 'bg-slate-400 dark:bg-slate-500',
  MEDIUM: 'bg-sky-500',
  HIGH: 'bg-amber-500',
  CRITICAL: 'bg-red-500',
}

export interface PriorityBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  priority: Priority
}

export const PriorityBadge = React.forwardRef<HTMLSpanElement, PriorityBadgeProps>(
  function PriorityBadge({ priority, className, ...props }, ref) {
    return (
      <span
        ref={ref}
        className={cn(badgeBase, priorityStyles[priority], className)}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', priorityDot[priority])}
        />
        {LABELS.priority[priority]}
      </span>
    )
  }
)

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: Status
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  function StatusBadge({ status, className, ...props }, ref) {
    return (
      <span ref={ref} className={cn(badgeBase, statusStyles[status], className)} {...props}>
        {LABELS.status[status]}
      </span>
    )
  }
)
