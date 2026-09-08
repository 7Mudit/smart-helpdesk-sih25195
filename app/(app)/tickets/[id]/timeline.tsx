import * as React from 'react'
import {
  AlertTriangle,
  ArrowUpCircle,
  CheckCircle2,
  CircleDot,
  Flag,
  GitBranch,
  Lock,
  MessageSquare,
  Paperclip,
  PlusCircle,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Star,
  Tag,
  UserCheck,
  XCircle,
} from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { LABELS, type EventType } from '@/lib/constants'
import { cn, formatDateTime, relativeTime } from '@/lib/utils'

export interface TimelineComment {
  kind: 'comment'
  id: string
  at: Date
  body: string
  isInternal: boolean
  author: { id: string; name: string; role: string } | null
}

export interface TimelineEvent {
  kind: 'event'
  id: string
  at: Date
  type: string
  fromValue: string | null
  toValue: string | null
  actor: { id: string; name: string } | null
}

export type TimelineEntry = TimelineComment | TimelineEvent

const EVENT_ICONS: Partial<Record<EventType, React.ComponentType<{ className?: string }>>> = {
  CREATED: PlusCircle,
  ASSIGNED: UserCheck,
  REASSIGNED: UserCheck,
  STATUS_CHANGED: RefreshCcw,
  PRIORITY_CHANGED: Flag,
  CATEGORY_CHANGED: Tag,
  COMMENTED: MessageSquare,
  INTERNAL_NOTE: Lock,
  ESCALATED: ArrowUpCircle,
  SLA_BREACHED: AlertTriangle,
  RESOLVED: CheckCircle2,
  REOPENED: RotateCcw,
  CLOSED: XCircle,
  AUTO_CLASSIFIED: Sparkles,
  AUTO_ROUTED: GitBranch,
  ATTACHMENT_ADDED: Paperclip,
  RATED: Star,
}

/** Events whose icon should read as a warning rather than neutral chrome. */
const ALERT_EVENTS = new Set<string>(['SLA_BREACHED', 'ESCALATED'])

/**
 * Friendly value rendering for enum-ish audit values.
 *
 * `names` maps user ids to display names. Assignment events store the agent's
 * id in toValue — the audit trail and the load balancer both need a stable
 * identifier rather than a name that can change — so the id is resolved here,
 * at the point of display, instead of denormalising a name into the event.
 */
function pretty(value: string | null, names?: Map<string, string>): string {
  if (!value) return '—'
  return (
    names?.get(value) ??
    (LABELS.status as Record<string, string>)[value] ??
    (LABELS.priority as Record<string, string>)[value] ??
    (LABELS.category as Record<string, string>)[value] ??
    (LABELS.department as Record<string, string>)[value] ??
    value
  )
}

/** An id that never resolved to a name should not be shown to a user. */
function looksLikeId(value: string): boolean {
  return /^c[a-z0-9]{20,}$/i.test(value)
}

function personOrFallback(value: string | null, names?: Map<string, string>): string {
  if (!value) return 'an agent'
  const resolved = names?.get(value)
  if (resolved) return resolved
  return looksLikeId(value) ? 'an agent' : value
}

function describe(event: TimelineEvent, names?: Map<string, string>): string {
  const who = event.actor?.name ?? 'System'
  const from = pretty(event.fromValue, names)
  const to = pretty(event.toValue, names)

  switch (event.type) {
    case 'CREATED':
      return `${who} raised this ticket`
    case 'ASSIGNED':
      return `${who} assigned the ticket to ${personOrFallback(event.toValue, names)}`
    case 'REASSIGNED':
      return `${who} reassigned the ticket from ${personOrFallback(
        event.fromValue,
        names,
      )} to ${personOrFallback(event.toValue, names)}`
    case 'STATUS_CHANGED':
      return `${who} changed the status from ${from} to ${to}`
    case 'PRIORITY_CHANGED':
      return `${who} changed the priority from ${from} to ${to}`
    case 'CATEGORY_CHANGED':
      return `${who} recategorised the ticket from ${from} to ${to}`
    case 'ESCALATED':
      return `Escalated from ${from} to ${to}`
    case 'SLA_BREACHED':
      return `SLA breached${event.toValue ? ` — ${event.toValue}` : ''}`
    case 'RESOLVED':
      return `${who} marked this ticket resolved`
    case 'REOPENED':
      return `${who} reopened this ticket`
    case 'CLOSED':
      return `${who} closed this ticket`
    case 'AUTO_CLASSIFIED':
      return `Auto-classified as ${to}${event.fromValue ? ` (${from})` : ''}`
    case 'AUTO_ROUTED':
      return `Auto-routed to ${to}`
    case 'ATTACHMENT_ADDED':
      return `${who} attached ${event.toValue ?? 'a file'}`
    case 'RATED':
      return `${who} rated the resolution ${event.toValue ?? ''}`.trim()
    case 'COMMENTED':
      return `${who} commented`
    case 'INTERNAL_NOTE':
      return `${who} added an internal note`
    default:
      return `${who} · ${event.type.toLowerCase().replace(/_/g, ' ')}`
  }
}

export interface TimelineProps {
  entries: TimelineEntry[]
  /** The requester, so their bubbles can be labelled. */
  requesterId: string
  /**
   * User id -> display name, for resolving the ids stored in assignment
   * events. Optional so the component still renders without it.
   */
  userNames?: Record<string, string>
}

export function Timeline({ entries, requesterId, userNames }: TimelineProps) {
  const names = React.useMemo(
    () => new Map(Object.entries(userNames ?? {})),
    [userNames],
  )

  if (entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center text-sm text-muted-foreground">
        Nothing has happened on this ticket yet.
      </p>
    )
  }

  return (
    <ol className="flex flex-col gap-4" aria-label="Ticket activity timeline">
      {entries.map((entry) =>
        entry.kind === 'comment' ? (
          <CommentBubble key={`c-${entry.id}`} comment={entry} requesterId={requesterId} />
        ) : (
          <EventLine key={`e-${entry.id}`} event={entry} names={names} />
        )
      )}
    </ol>
  )
}

function CommentBubble({
  comment,
  requesterId,
}: {
  comment: TimelineComment
  requesterId: string
}) {
  const name = comment.author?.name ?? 'Unknown user'
  const isRequester = comment.author?.id === requesterId

  return (
    <li className="flex gap-3">
      <Avatar name={name} id={comment.author?.id ?? name} size="md" className="mt-0.5" />

      <div
        className={cn(
          'min-w-0 flex-1 rounded-lg border bg-card p-4',
          comment.isInternal
            ? 'border-l-4 border-l-amber-400 border-y-border border-r-border bg-amber-50/50 dark:border-l-amber-500 dark:bg-amber-950/30'
            : 'border-border'
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-foreground">{name}</span>

          {comment.isInternal ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-inset ring-amber-300 dark:bg-amber-900 dark:text-amber-100 dark:ring-amber-700">
              <Lock aria-hidden="true" className="h-3 w-3" />
              Internal note
            </span>
          ) : (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {isRequester ? 'Requester' : (comment.author?.role ?? 'Staff').toLowerCase()}
            </span>
          )}

          <time
            dateTime={comment.at.toISOString()}
            title={formatDateTime(comment.at)}
            className="ml-auto text-xs text-muted-foreground"
          >
            {relativeTime(comment.at)}
          </time>
        </div>

        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
          {comment.body}
        </p>
      </div>
    </li>
  )
}

function EventLine({ event, names }: { event: TimelineEvent; names: Map<string, string> }) {
  const Icon = EVENT_ICONS[event.type as EventType] ?? CircleDot
  const alert = ALERT_EVENTS.has(event.type)

  return (
    <li className="flex items-center gap-3 pl-1">
      <span
        aria-hidden="true"
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset',
          alert
            ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800'
            : 'bg-muted text-muted-foreground ring-border'
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
        <span className="break-words">{describe(event, names)}</span>
      </p>

      <time
        dateTime={event.at.toISOString()}
        title={formatDateTime(event.at)}
        className="shrink-0 text-xs text-muted-foreground"
      >
        {relativeTime(event.at)}
      </time>
    </li>
  )
}
