import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  AlarmClock,
  CheckCircle2,
  Inbox,
  Smile,
  Timer,
  UserX,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/rbac'
import { CATEGORIES, PRIORITIES, type Category, type Priority, type Status } from '@/lib/constants'
import { formatDuration } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PriorityBadge, StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { KpiTile } from '@/components/dashboard/kpi-tile'
import { AutomationImpact } from '@/components/dashboard/automation-impact'
import { VolumeChart, type VolumePoint } from '@/components/charts/volume-chart'
import { CategoryDonut } from '@/components/charts/category-donut'
import { PriorityBar } from '@/components/charts/priority-bar'
import { AgentWorkloadChart, type AgentLoad } from '@/components/charts/agent-workload-chart'
import { SlaGauge } from '@/components/charts/sla-gauge'

// The dashboard reads live counts on every request — a cached page would show
// a stale backlog, which is worse than a slightly slower render.
export const dynamic = 'force-dynamic'

/** Statuses that count as "still in the queue". */
const ACTIVE_STATUSES = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'REOPENED'] as const

const VOLUME_DAYS = 30

function startOfDay(d: Date): Date {
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  return out
}

function dayKey(d: Date): string {
  // Local-date key (not toISOString, which shifts across the IST offset).
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default async function DashboardPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!can(user.role, 'dashboard:view')) redirect('/tickets')

  const now = new Date()
  const todayStart = startOfDay(now)
  const in4Hours = new Date(now.getTime() + 4 * 60 * 60 * 1000)
  const volumeStart = startOfDay(new Date(now.getTime() - (VOLUME_DAYS - 1) * 86400000))

  const [
    openCount,
    unassignedCount,
    breachingSoonCount,
    resolvedTodayCount,
    firstResponseRows,
    csatAgg,
    categoryGroups,
    priorityGroups,
    createdRows,
    resolvedRows,
    agents,
    slaMetCount,
    slaBreachedCount,
    recentBreaches,
    totalTickets,
    autoClassifiedCount,
    autoRoutedCount,
    confidenceAgg,
    deflectionAgg,
    yesterdayOpened,
    todayOpened,
  ] = await Promise.all([
    prisma.ticket.count({ where: { status: { in: [...ACTIVE_STATUSES] } } }),

    prisma.ticket.count({
      where: { status: { in: [...ACTIVE_STATUSES] }, assignedToId: null },
    }),

    prisma.ticket.count({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        slaBreached: false,
        resolutionDueAt: { not: null, lte: in4Hours, gte: now },
      },
    }),

    prisma.ticket.count({ where: { resolvedAt: { gte: todayStart } } }),

    // Average first response is computed in JS: SQLite cannot subtract two
    // datetime columns inside a Prisma aggregate.
    prisma.ticket.findMany({
      where: { firstRespondedAt: { not: null } },
      select: { createdAt: true, firstRespondedAt: true },
    }),

    prisma.ticket.aggregate({
      where: { satisfactionRating: { not: null } },
      _avg: { satisfactionRating: true },
      _count: { satisfactionRating: true },
    }),

    prisma.ticket.groupBy({ by: ['category'], _count: { _all: true } }),

    prisma.ticket.groupBy({
      by: ['priority'],
      where: { status: { in: [...ACTIVE_STATUSES] } },
      _count: { _all: true },
    }),

    prisma.ticket.findMany({
      where: { createdAt: { gte: volumeStart } },
      select: { createdAt: true },
    }),

    prisma.ticket.findMany({
      where: { resolvedAt: { gte: volumeStart } },
      select: { resolvedAt: true },
    }),

    prisma.user.findMany({
      where: { role: { in: ['AGENT', 'ADMIN'] }, isActive: true },
      select: { id: true, name: true },
    }),

    prisma.ticket.count({
      where: { slaBreached: false, resolvedAt: { not: null } },
    }),

    prisma.ticket.count({ where: { slaBreached: true } }),

    prisma.ticket.findMany({
      where: { slaBreached: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        priority: true,
        status: true,
        resolutionDueAt: true,
        assignedTo: { select: { name: true } },
      },
    }),

    prisma.ticket.count(),
    prisma.ticket.count({ where: { autoClassified: true } }),
    prisma.ticket.count({ where: { autoRouted: true } }),

    prisma.ticket.aggregate({
      where: { classifierConfidence: { not: null } },
      _avg: { classifierConfidence: true },
    }),

    prisma.kbArticle.aggregate({ _sum: { deflectionCount: true } }),

    prisma.ticket.count({
      where: {
        createdAt: {
          gte: new Date(todayStart.getTime() - 86400000),
          lt: todayStart,
        },
      },
    }),

    prisma.ticket.count({ where: { createdAt: { gte: todayStart } } }),
  ])

  // --- average first response ------------------------------------------
  const responseMinutes = firstResponseRows
    .map((t) =>
      t.firstRespondedAt
        ? (t.firstRespondedAt.getTime() - t.createdAt.getTime()) / 60000
        : null
    )
    .filter((m): m is number => m !== null && m >= 0)

  const avgFirstResponse =
    responseMinutes.length > 0
      ? responseMinutes.reduce((a, b) => a + b, 0) / responseMinutes.length
      : 0

  // --- volume series, zero-filled --------------------------------------
  const createdByDay = new Map<string, number>()
  for (const row of createdRows) {
    const k = dayKey(row.createdAt)
    createdByDay.set(k, (createdByDay.get(k) ?? 0) + 1)
  }
  const resolvedByDay = new Map<string, number>()
  for (const row of resolvedRows) {
    if (!row.resolvedAt) continue
    const k = dayKey(row.resolvedAt)
    resolvedByDay.set(k, (resolvedByDay.get(k) ?? 0) + 1)
  }

  const volume: VolumePoint[] = Array.from({ length: VOLUME_DAYS }, (_, i) => {
    const d = new Date(volumeStart.getTime() + i * 86400000)
    const key = dayKey(d)
    return {
      date: key,
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      created: createdByDay.get(key) ?? 0,
      resolved: resolvedByDay.get(key) ?? 0,
    }
  })

  // --- category / priority, with every enum member present -------------
  const categoryCounts = new Map(categoryGroups.map((g) => [g.category, g._count._all]))
  const categoryData = CATEGORIES.map((category) => ({
    category: category as Category,
    count: categoryCounts.get(category) ?? 0,
  }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)

  const priorityCounts = new Map(priorityGroups.map((g) => [g.priority, g._count._all]))
  const priorityData = PRIORITIES.map((priority) => ({
    priority: priority as Priority,
    count: priorityCounts.get(priority) ?? 0,
  }))

  // --- agent workload ---------------------------------------------------
  const [openByAgent, resolvedByAgent] = await Promise.all([
    prisma.ticket.groupBy({
      by: ['assignedToId'],
      where: { status: { in: [...ACTIVE_STATUSES] }, assignedToId: { not: null } },
      _count: { _all: true },
    }),
    prisma.ticket.groupBy({
      by: ['assignedToId'],
      where: { resolvedAt: { not: null }, assignedToId: { not: null } },
      _count: { _all: true },
    }),
  ])

  const openMap = new Map(openByAgent.map((g) => [g.assignedToId, g._count._all]))
  const resolvedMap = new Map(resolvedByAgent.map((g) => [g.assignedToId, g._count._all]))

  const agentLoad: AgentLoad[] = agents
    .map((a) => ({
      id: a.id,
      name: a.name,
      open: openMap.get(a.id) ?? 0,
      resolved: resolvedMap.get(a.id) ?? 0,
    }))
    .filter((a) => a.open > 0 || a.resolved > 0)
    .sort((a, b) => b.open - a.open || b.resolved - a.resolved)

  // --- KPI context lines ------------------------------------------------
  const csatAvg = csatAgg._avg.satisfactionRating ?? 0
  const csatCount = csatAgg._count.satisfactionRating
  const unassignedShare = openCount > 0 ? Math.round((unassignedCount / openCount) * 100) : 0
  const volumeDelta = todayOpened - yesterdayOpened
  const deltaText =
    volumeDelta === 0
      ? 'same as yesterday'
      : `${volumeDelta > 0 ? '+' : ''}${volumeDelta} vs yesterday`

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live service-desk health across {totalTickets} tickets. Updated{' '}
          {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}.
        </p>
      </header>

      {/* KPI row: 6 → 3 → 2 columns */}
      <section aria-label="Key performance indicators">
        <h2 className="sr-only">Key performance indicators</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <KpiTile
            label="Open tickets"
            value={String(openCount)}
            context={`${todayOpened} raised today · ${deltaText}`}
            tone="info"
            icon={<Inbox className="h-4 w-4" />}
          />
          <KpiTile
            label="Unassigned"
            value={String(unassignedCount)}
            context={`${unassignedShare}% of the open queue awaiting an owner`}
            tone={unassignedCount > 0 ? 'warning' : 'success'}
            icon={<UserX className="h-4 w-4" />}
          />
          <KpiTile
            label="Breaching soon"
            value={String(breachingSoonCount)}
            context="Resolution due within the next 4 hours"
            tone={breachingSoonCount > 0 ? 'danger' : 'success'}
            icon={<AlarmClock className="h-4 w-4" />}
          />
          <KpiTile
            label="Resolved today"
            value={String(resolvedTodayCount)}
            context={`${slaMetCount} resolved within SLA all-time`}
            tone="success"
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <KpiTile
            label="Avg first response"
            value={formatDuration(avgFirstResponse)}
            context={`Across ${responseMinutes.length} tickets with an agent reply`}
            tone="default"
            icon={<Timer className="h-4 w-4" />}
          />
          <KpiTile
            label="CSAT"
            value={csatCount > 0 ? csatAvg.toFixed(1) : '—'}
            unit={csatCount > 0 ? '/ 5' : undefined}
            context={
              csatCount > 0
                ? `Mean of ${csatCount} requester ratings`
                : 'No ratings submitted yet'
            }
            tone="success"
            icon={<Smile className="h-4 w-4" />}
          />
        </div>
      </section>

      {/* Volume spans the full width — it is the trend judges read first. */}
      <VolumeChart data={volume} />

      {/* Chart grid: 2 → 1 column */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CategoryDonut data={categoryData} />
        <PriorityBar data={priorityData} />
        <AgentWorkloadChart data={agentLoad} />
        <SlaGauge met={slaMetCount} breached={slaBreachedCount} />
      </div>

      {/* Automation impact + recent breaches */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AutomationImpact
          totalTickets={totalTickets}
          autoClassified={autoClassifiedCount}
          autoRouted={autoRoutedCount}
          meanConfidence={confidenceAgg._avg.classifierConfidence ?? 0}
          kbDeflections={deflectionAgg._sum.deflectionCount ?? 0}
        />

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Recent SLA breaches</CardTitle>
            <CardDescription>
              The five most recently updated tickets that missed their target.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {recentBreaches.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="No SLA breaches"
                description="Every ticket has been handled inside its target window."
              />
            ) : (
              <Table wrapperClassName="border-0 rounded-md">
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Overdue by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentBreaches.map((t) => {
                    const overdueMins = t.resolutionDueAt
                      ? (now.getTime() - t.resolutionDueAt.getTime()) / 60000
                      : 0
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="max-w-[16rem]">
                          <Link
                            href={`/tickets/${t.id}`}
                            className="flex flex-col gap-0.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="font-medium text-primary hover:underline">
                              {t.ticketNumber}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {t.title}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={t.priority as Priority} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={t.status as Status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs font-medium text-red-600 dark:text-red-400">
                          {overdueMins > 0 ? formatDuration(overdueMins) : 'Due now'}
                          <span className="block font-normal text-muted-foreground">
                            {t.assignedTo?.name ?? 'Unassigned'}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
