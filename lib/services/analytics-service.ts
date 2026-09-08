// Dashboard aggregation.
//
// Deliberately org-wide for both AGENT and ADMIN: an agent who cannot see the
// backlog they are part of cannot prioritise within it, and the SIH story is
// "management visibility". Role gating happens at the route (`dashboard:view`),
// not by quietly narrowing the numbers.

import { prisma } from '@/lib/db'
import { AuthError, type SessionUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { CATEGORIES, PRIORITIES, STATUSES } from '@/lib/constants'
import { OPEN_STATUSES } from './ticket-service'

const DAY_MS = 24 * 60 * 60 * 1000
const VOLUME_DAYS = 30
const BREACHING_SOON_HOURS = 4

export interface DashboardStats {
  kpis: {
    openTickets: number
    unassignedTickets: number
    breachingSoon: number
    resolvedToday: number
    avgFirstResponseMins: number | null
    avgResolutionMins: number | null
    csatAverage: number | null
    csatCount: number
    slaCompliancePercent: number | null
  }
  volumeSeries: { date: string; created: number; resolved: number }[]
  categoryBreakdown: { category: string; count: number }[]
  priorityBreakdown: { priority: string; count: number }[]
  statusBreakdown: { status: string; count: number }[]
  agentWorkload: {
    agentId: string
    name: string
    open: number
    resolved: number
    avgResolutionMins: number | null
  }[]
  recentBreaches: {
    id: string
    ticketNumber: string
    title: string
    priority: string
    assigneeName: string | null
    resolutionDueAt: Date | null
  }[]
}

/** Local-time YYYY-MM-DD — the dashboard is read in IST, not UTC. */
function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function round(n: number | null, dp = 1): number | null {
  if (n === null) return null
  const f = 10 ** dp
  return Math.round(n * f) / f
}

export async function getDashboardStats(user: SessionUser): Promise<DashboardStats> {
  if (!can(user.role, 'dashboard:view')) {
    throw new AuthError('You are not allowed to view the dashboard', 403)
  }

  const now = new Date()
  const todayStart = startOfDay(now)
  const windowStart = startOfDay(new Date(now.getTime() - (VOLUME_DAYS - 1) * DAY_MS))
  const breachHorizon = new Date(now.getTime() + BREACHING_SOON_HOURS * 60 * 60 * 1000)

  const [
    openTickets,
    unassignedTickets,
    breachingSoon,
    resolvedToday,
    csatAgg,
    categoryGroups,
    priorityGroups,
    statusGroups,
    slaTotal,
    slaBreachedCount,
    responseRows,
    resolutionRows,
    volumeCreatedRows,
    volumeResolvedRows,
    agents,
    recentBreachRows,
  ] = await Promise.all([
    prisma.ticket.count({ where: { status: { in: OPEN_STATUSES } } }),

    prisma.ticket.count({
      where: { status: { in: OPEN_STATUSES }, assignedToId: null },
    }),

    prisma.ticket.count({
      where: {
        status: { in: OPEN_STATUSES },
        slaBreached: false,
        resolutionDueAt: { not: null, lte: breachHorizon, gte: now },
      },
    }),

    prisma.ticket.count({ where: { resolvedAt: { gte: todayStart } } }),

    prisma.ticket.aggregate({
      where: { satisfactionRating: { not: null } },
      _avg: { satisfactionRating: true },
      _count: { satisfactionRating: true },
    }),

    prisma.ticket.groupBy({ by: ['category'], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),

    // SLA compliance is measured over tickets that have actually finished —
    // an open ticket has not yet passed or failed anything.
    prisma.ticket.count({ where: { resolvedAt: { not: null } } }),
    prisma.ticket.count({
      where: { resolvedAt: { not: null }, slaBreached: true },
    }),

    prisma.ticket.findMany({
      where: { firstRespondedAt: { not: null } },
      select: { createdAt: true, firstRespondedAt: true },
    }),

    prisma.ticket.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true, assignedToId: true },
    }),

    prisma.ticket.findMany({
      where: { createdAt: { gte: windowStart } },
      select: { createdAt: true },
    }),

    prisma.ticket.findMany({
      where: { resolvedAt: { gte: windowStart } },
      select: { resolvedAt: true },
    }),

    prisma.user.findMany({
      where: { role: 'AGENT', isActive: true },
      select: { id: true, name: true },
    }),

    prisma.ticket.findMany({
      where: { slaBreached: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        priority: true,
        resolutionDueAt: true,
        assignedTo: { select: { name: true } },
      },
    }),
  ])

  // --- durations ------------------------------------------------------
  const avgFirstResponseMins = mean(
    responseRows
      .filter((t) => t.firstRespondedAt)
      .map((t) => (t.firstRespondedAt!.getTime() - t.createdAt.getTime()) / 60000)
      .filter((m) => m >= 0),
  )

  const avgResolutionMins = mean(
    resolutionRows
      .filter((t) => t.resolvedAt)
      .map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 60000)
      .filter((m) => m >= 0),
  )

  const slaCompliancePercent =
    slaTotal > 0 ? ((slaTotal - slaBreachedCount) / slaTotal) * 100 : null

  // --- volume series: every day present, including zero days ----------
  const createdByDay = new Map<string, number>()
  for (const t of volumeCreatedRows) {
    const k = dayKey(t.createdAt)
    createdByDay.set(k, (createdByDay.get(k) ?? 0) + 1)
  }
  const resolvedByDay = new Map<string, number>()
  for (const t of volumeResolvedRows) {
    if (!t.resolvedAt) continue
    const k = dayKey(t.resolvedAt)
    resolvedByDay.set(k, (resolvedByDay.get(k) ?? 0) + 1)
  }

  const volumeSeries: DashboardStats['volumeSeries'] = []
  for (let i = 0; i < VOLUME_DAYS; i++) {
    const d = new Date(windowStart.getTime() + i * DAY_MS)
    const k = dayKey(d)
    volumeSeries.push({
      date: k,
      created: createdByDay.get(k) ?? 0,
      resolved: resolvedByDay.get(k) ?? 0,
    })
  }

  // --- breakdowns: keep the canonical order, include empty buckets -----
  const tally = (rows: { _count: { _all: number } }[], values: string[]) => {
    const map = new Map<string, number>()
    rows.forEach((row, i) => {
      map.set(values[i]!, (map.get(values[i]!) ?? 0) + row._count._all)
    })
    return map
  }

  const categoryMap = tally(
    categoryGroups,
    categoryGroups.map((r) => r.category),
  )
  const priorityMap = tally(
    priorityGroups,
    priorityGroups.map((r) => r.priority),
  )
  const statusMap = tally(
    statusGroups,
    statusGroups.map((r) => r.status),
  )

  const categoryBreakdown = CATEGORIES.map((category) => ({
    category,
    count: categoryMap.get(category) ?? 0,
  }))
  const priorityBreakdown = PRIORITIES.map((priority) => ({
    priority,
    count: priorityMap.get(priority) ?? 0,
  }))
  const statusBreakdown = STATUSES.map((status) => ({
    status,
    count: statusMap.get(status) ?? 0,
  }))

  // --- agent workload --------------------------------------------------
  const openByAgent = await prisma.ticket.groupBy({
    by: ['assignedToId'],
    where: { status: { in: OPEN_STATUSES }, assignedToId: { not: null } },
    _count: { _all: true },
  })
  const openMap = new Map(
    openByAgent.map((r) => [r.assignedToId as string, r._count._all]),
  )

  const resolvedMap = new Map<string, number>()
  const durationsByAgent = new Map<string, number[]>()
  for (const t of resolutionRows) {
    if (!t.assignedToId || !t.resolvedAt) continue
    resolvedMap.set(t.assignedToId, (resolvedMap.get(t.assignedToId) ?? 0) + 1)
    const mins = (t.resolvedAt.getTime() - t.createdAt.getTime()) / 60000
    if (mins >= 0) {
      const list = durationsByAgent.get(t.assignedToId) ?? []
      list.push(mins)
      durationsByAgent.set(t.assignedToId, list)
    }
  }

  const agentWorkload = agents
    .map((a) => ({
      agentId: a.id,
      name: a.name,
      open: openMap.get(a.id) ?? 0,
      resolved: resolvedMap.get(a.id) ?? 0,
      avgResolutionMins: round(mean(durationsByAgent.get(a.id) ?? [])),
    }))
    .sort((x, y) => y.open - x.open || y.resolved - x.resolved)

  return {
    kpis: {
      openTickets,
      unassignedTickets,
      breachingSoon,
      resolvedToday,
      avgFirstResponseMins: round(avgFirstResponseMins),
      avgResolutionMins: round(avgResolutionMins),
      csatAverage: round(csatAgg._avg.satisfactionRating ?? null, 2),
      csatCount: csatAgg._count.satisfactionRating,
      slaCompliancePercent: round(slaCompliancePercent),
    },
    volumeSeries,
    categoryBreakdown,
    priorityBreakdown,
    statusBreakdown,
    agentWorkload,
    recentBreaches: recentBreachRows.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      title: t.title,
      priority: t.priority,
      assigneeName: t.assignedTo?.name ?? null,
      resolutionDueAt: t.resolutionDueAt,
    })),
  }
}
