import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BookOpen, ShieldAlert, Star } from 'lucide-react'
import { SlaBadge, slaCountdown } from '@/components/sla-badge'
import { Avatar } from '@/components/ui/avatar'
import { Badge, PriorityBadge, StatusBadge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SlaBar, type SlaState } from '@/components/ui/progress'
import { getCurrentUser } from '@/lib/auth'
import {
  LABELS,
  TERMINAL_STATUSES,
  type Category,
  type Channel,
  type Department,
  type Priority,
  type Status,
} from '@/lib/constants'
import { prisma } from '@/lib/db'
import { can, canViewTicket } from '@/lib/rbac'
import { formatDateTime, formatDuration, relativeTime } from '@/lib/utils'
import { ReplyComposer } from './reply-composer'
import { SatisfactionSurvey } from './satisfaction-survey'
import { TicketControls } from './ticket-controls'
import { Timeline, type TimelineEntry } from './timeline'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { ticketNumber: true, title: true },
  })
  return {
    title: ticket ? `${ticket.ticketNumber} · ${ticket.title} — Smart Helpdesk` : 'Ticket — Smart Helpdesk',
  }
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return null

  const staff = can(user.role, 'ticket:readAll')
  const seesInternal = can(user.role, 'comment:readInternal')

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true, department: true } },
      assignedTo: { select: { id: true, name: true } },
      slaPolicy: {
        select: { name: true, firstResponseMins: true, resolutionMins: true, businessHoursOnly: true },
      },
      // SECURITY: internal worknotes are excluded in the QUERY, so they never
      // reach the client for a viewer who lacks the permission.
      comments: {
        where: seesInternal ? {} : { isInternal: false },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, role: true } } },
      },
      events: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true } } },
      },
      attachments: {
        select: { id: true, filename: true, sizeBytes: true, mimeType: true },
      },
    },
  })

  if (!ticket) notFound()

  if (!canViewTicket(user, ticket)) {
    return <AccessDenied />
  }

  const status = ticket.status as Status
  const priority = ticket.priority as Priority
  const category = ticket.category as Category
  const department = ticket.department as Department

  const [agents, relatedArticles] = await Promise.all([
    staff
      ? prisma.user.findMany({
          where: { role: { in: ['AGENT', 'ADMIN'] }, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    prisma.kbArticle.findMany({
      where: { isPublished: true, category: ticket.category },
      select: { id: true, slug: true, title: true, viewCount: true },
      orderBy: { helpfulCount: 'desc' },
      take: 4,
    }),
  ])

  // --- unified timeline -------------------------------------------------
  const entries: TimelineEntry[] = [
    ...ticket.comments.map((c) => ({
      kind: 'comment' as const,
      id: c.id,
      at: c.createdAt,
      body: c.body,
      isInternal: c.isInternal,
      author: c.author,
    })),
    ...ticket.events
      // COMMENTED events would duplicate the bubble immediately above them.
      .filter((e) => e.type !== 'COMMENTED' && e.type !== 'INTERNAL_NOTE')
      .map((e) => ({
        kind: 'event' as const,
        id: e.id,
        at: e.createdAt,
        type: e.type,
        fromValue: e.fromValue,
        toValue: e.toValue,
        actor: e.actor,
      })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime())

  // Assignment events store agent ids (a name can change; the audit trail and
  // the load balancer both need a stable key), so resolve them to names for
  // display. Every viewer needs this, not just those who can reassign.
  const referencedUserIds = Array.from(
    new Set(
      ticket.events
        .filter((e) => e.type === 'ASSIGNED' || e.type === 'REASSIGNED')
        .flatMap((e) => [e.fromValue, e.toValue])
        .filter((v): v is string => Boolean(v)),
    ),
  )

  const userNames: Record<string, string> = {}
  if (referencedUserIds.length > 0) {
    const referenced = await prisma.user.findMany({
      where: { id: { in: referencedUserIds } },
      select: { id: true, name: true },
    })
    for (const u of referenced) userNames[u.id] = u.name
  }

  const isTerminal = TERMINAL_STATUSES.includes(status)
  const showSurvey =
    isTerminal && ticket.createdById === user.id && ticket.satisfactionRating === null

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-6">
      {/* ------------------------------------------------------------ header */}
      <header className="flex flex-col gap-4">
        <Link
          href="/tickets"
          className="w-fit rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          ← Back to tickets
        </Link>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm font-semibold text-primary">
              {ticket.ticketNumber}
            </span>
            <StatusBadge status={status} />
            <PriorityBadge priority={priority} />
            <Badge variant="secondary">{LABELS.category[category] ?? ticket.category}</Badge>
            <Badge variant="outline">
              {LABELS.channel[ticket.channel as Channel] ?? ticket.channel}
            </Badge>
            <SlaBadge
              dueAt={ticket.resolutionDueAt}
              resolvedAt={ticket.resolvedAt}
              breached={ticket.slaBreached}
            />
          </div>

          <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
            {ticket.title}
          </h1>

          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Avatar name={ticket.createdBy.name} id={ticket.createdBy.id} size="sm" />
            <span>
              Raised by{' '}
              <span className="font-medium text-foreground">{ticket.createdBy.name}</span>
            </span>
            <span aria-hidden="true">·</span>
            <time dateTime={ticket.createdAt.toISOString()} title={formatDateTime(ticket.createdAt)}>
              {relativeTime(ticket.createdAt)}
            </time>
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* -------------------------------------------------- main column */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                {ticket.description}
              </p>
            </CardContent>
          </Card>

          <section aria-labelledby="activity-heading" className="flex flex-col gap-4">
            <h2 id="activity-heading" className="text-base font-semibold text-foreground">
              Activity
            </h2>
            <Timeline
              entries={entries}
              requesterId={ticket.createdById}
              userNames={userNames}
            />
          </section>

          <section aria-labelledby="reply-heading" className="flex flex-col gap-3">
            <h2 id="reply-heading" className="sr-only">
              Reply to this ticket
            </h2>
            <ReplyComposer ticketId={ticket.id} canPostInternal={seesInternal} />
          </section>

          {showSurvey ? <SatisfactionSurvey ticketId={ticket.id} /> : null}

          {ticket.satisfactionRating !== null ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Star aria-hidden="true" className="h-4 w-4 text-amber-500" />
                  Satisfaction rating
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">{ticket.satisfactionRating} / 5</span> from the
                  requester
                </p>
                {ticket.satisfactionComment ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    “{ticket.satisfactionComment}”
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* --------------------------------------------------- right rail */}
        <aside aria-label="Ticket details and controls" className="flex flex-col gap-4">
          {staff ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Manage</CardTitle>
              </CardHeader>
              <CardContent>
                <TicketControls
                  ticketId={ticket.id}
                  status={status}
                  priority={priority}
                  department={department}
                  assignedToId={ticket.assignedToId}
                  agents={agents}
                />
              </CardContent>
            </Card>
          ) : null}

          <SlaPanel
            createdAt={ticket.createdAt}
            firstResponseDueAt={ticket.firstResponseDueAt}
            firstRespondedAt={ticket.firstRespondedAt}
            resolutionDueAt={ticket.resolutionDueAt}
            resolvedAt={ticket.resolvedAt}
            breached={ticket.slaBreached}
            policyName={ticket.slaPolicy?.name ?? null}
            holdMinutes={ticket.holdMinutes}
          />

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-3 text-sm">
                <Meta label="Assignee">
                  {ticket.assignedTo ? (
                    <span className="flex items-center gap-2">
                      <Avatar name={ticket.assignedTo.name} id={ticket.assignedTo.id} size="sm" />
                      {ticket.assignedTo.name}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </Meta>
                <Meta label="Department">
                  {LABELS.department[department] ?? ticket.department}
                </Meta>
                <Meta label="Channel">
                  {LABELS.channel[ticket.channel as Channel] ?? ticket.channel}
                </Meta>
                <Meta label="Requester">
                  <span className="flex flex-col">
                    <span>{ticket.createdBy.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {ticket.createdBy.email}
                    </span>
                  </span>
                </Meta>
                <Meta label="Created">{formatDateTime(ticket.createdAt)}</Meta>
                <Meta label="Last updated">{relativeTime(ticket.updatedAt)}</Meta>
                {ticket.resolvedAt ? (
                  <Meta label="Resolved">{formatDateTime(ticket.resolvedAt)}</Meta>
                ) : null}
                {ticket.autoClassified ? (
                  <Meta label="Classification">
                    <span className="flex flex-col gap-1">
                      <Badge variant="default" className="w-fit">
                        Auto-classified
                      </Badge>
                      {ticket.classifierConfidence !== null ? (
                        <span className="text-xs text-muted-foreground">
                          {Math.round(ticket.classifierConfidence * 100)}% confidence
                        </span>
                      ) : null}
                    </span>
                  </Meta>
                ) : null}
                {ticket.autoRouted ? (
                  <Meta label="Routing">
                    <Badge variant="secondary" className="w-fit">
                      Auto-routed
                    </Badge>
                  </Meta>
                ) : null}
                {ticket.attachments.length > 0 ? (
                  <Meta label="Attachments">
                    <span>{ticket.attachments.length} file(s)</span>
                  </Meta>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <BookOpen aria-hidden="true" className="h-4 w-4 text-primary" />
                Related articles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {relatedArticles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No published articles for this category yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {relatedArticles.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/kb/${a.slug}`}
                        className="block rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {a.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{children}</dd>
    </div>
  )
}

function SlaPanel({
  createdAt,
  firstResponseDueAt,
  firstRespondedAt,
  resolutionDueAt,
  resolvedAt,
  breached,
  policyName,
  holdMinutes,
}: {
  createdAt: Date
  firstResponseDueAt: Date | null
  firstRespondedAt: Date | null
  resolutionDueAt: Date | null
  resolvedAt: Date | null
  breached: boolean
  policyName: string | null
  holdMinutes: number
}) {
  const now = new Date()

  function track(dueAt: Date | null, completedAt: Date | null) {
    if (!dueAt) {
      return { state: 'MET' as SlaState, percent: 0, text: 'No deadline set' }
    }

    if (completedAt) {
      const late = completedAt.getTime() > dueAt.getTime()
      return {
        state: (late ? 'BREACHED' : 'MET') as SlaState,
        percent: 100,
        text: late
          ? `Missed by ${formatDuration((completedAt.getTime() - dueAt.getTime()) / 60000)}`
          : `Met with ${formatDuration((dueAt.getTime() - completedAt.getTime()) / 60000)} to spare`,
      }
    }

    const window = dueAt.getTime() - createdAt.getTime()
    const consumed = now.getTime() - createdAt.getTime()
    const percent = window > 0 ? (consumed / window) * 100 : 100
    const remaining = (dueAt.getTime() - now.getTime()) / 60000

    if (remaining <= 0) {
      return {
        state: 'BREACHED' as SlaState,
        percent: 100,
        text: `Overdue by ${formatDuration(Math.abs(remaining))}`,
      }
    }

    return {
      state: (percent >= 80 ? 'AT_RISK' : 'ON_TRACK') as SlaState,
      percent,
      text: `${formatDuration(remaining)} remaining`,
    }
  }

  const first = track(firstResponseDueAt, firstRespondedAt)
  const resolution = track(resolutionDueAt, resolvedAt)
  const overall = slaCountdown(resolutionDueAt, { resolvedAt, breached })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>Service level</span>
          <SlaBadge dueAt={resolutionDueAt} resolvedAt={resolvedAt} breached={breached} />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <SlaTrack
          label="First response"
          due={firstResponseDueAt}
          state={first.state}
          percent={first.percent}
          text={first.text}
        />
        <SlaTrack
          label="Resolution"
          due={resolutionDueAt}
          state={resolution.state}
          percent={resolution.percent}
          text={resolution.text}
        />

        <div className="flex flex-col gap-1 border-t border-border pt-3 text-xs text-muted-foreground">
          {policyName ? <p>Policy: {policyName}</p> : null}
          {holdMinutes > 0 ? <p>On-hold credit: {formatDuration(holdMinutes)}</p> : null}
          <p className="sr-only">{overall.detail}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function SlaTrack({
  label,
  due,
  state,
  percent,
  text,
}: {
  label: string
  due: Date | null
  state: SlaState
  percent: number
  text: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{text}</span>
      </div>
      <SlaBar percent={percent} state={state} showLabel />
      {due ? (
        <p className="text-xs text-muted-foreground">Due {formatDateTime(due)}</p>
      ) : null}
    </div>
  )
}

function AccessDenied() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 rounded-lg border border-border bg-card px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
      >
        <ShieldAlert className="h-6 w-6" />
      </span>
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">Access denied</h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to view this ticket. Employees can only see the tickets they
          raised themselves.
        </p>
      </div>
      <Link
        href="/tickets"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        Back to my tickets
      </Link>
    </div>
  )
}
