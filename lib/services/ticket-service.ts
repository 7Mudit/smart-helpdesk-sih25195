// Orchestration layer for tickets.
//
// Route handlers stay thin: they parse, authenticate, and delegate here. All
// the business rules — automation on create, per-field permission checks on
// update, audit-event writing, SLA side effects — live in this file so they
// are testable without an HTTP layer and impossible to bypass by hitting a
// different route.

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { AuthError, type SessionUser } from '@/lib/auth'
import { can, canRateTicket, canViewTicket } from '@/lib/rbac'
import { insensitiveContains } from '@/lib/search-filter'
import type { Category, Department, Priority, Status } from '@/lib/constants'
import type {
  CreateTicketInput,
  TicketFilterInput,
  UpdateTicketInput,
} from '@/lib/validation'
import { classifyTicket } from '@/lib/automation/classifier'
import { routeTicket, type AgentLoad, type Rule } from '@/lib/automation/router'
import { computeSlaTargets, recomputeSlaTargets } from '@/lib/automation/sla'
import { nextTicketNumber } from '@/lib/automation/ticket-number'

// Statuses that count as "still being worked" — used for agent load and for
// the ON_HOLD clock.
const OPEN_STATUSES: Status[] = ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'REOPENED']

/** Public shape for embedded user references — never leaks passwordHash. */
const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  department: true,
} as const

// ---------------------------------------------------------------- helpers

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null
  return d instanceof Date ? d : new Date(d)
}

/** Minutes between two instants, floored at zero. */
function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000))
}

function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
  )
}

/**
 * Active agents with their current open-ticket count and most recent
 * assignment time — exactly the shape `pickAgent` load-balances over.
 */
async function loadAgentLoads(): Promise<AgentLoad[]> {
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT', isActive: true },
    select: { id: true, department: true, isActive: true },
  })
  if (agents.length === 0) return []

  const agentIds = agents.map((a) => a.id)

  const openCounts = await prisma.ticket.groupBy({
    by: ['assignedToId'],
    where: {
      assignedToId: { in: agentIds },
      status: { in: OPEN_STATUSES },
    },
    _count: { _all: true },
  })
  const countByAgent = new Map(
    openCounts.map((row) => [row.assignedToId, row._count._all]),
  )

  // Most recent ASSIGNED/REASSIGNED-equivalent moment per agent. Using the
  // ticket's own updatedAt would be noisy (a comment bumps it), so the
  // assignment audit events are the honest source.
  const lastAssigned = await prisma.ticketEvent.groupBy({
    by: ['toValue'],
    where: {
      type: { in: ['ASSIGNED', 'REASSIGNED'] },
      toValue: { in: agentIds },
    },
    _max: { createdAt: true },
  })
  const lastByAgent = new Map(
    lastAssigned.map((row) => [row.toValue, row._max.createdAt]),
  )

  return agents.map((a) => ({
    id: a.id,
    department: a.department,
    isActive: a.isActive,
    openTicketCount: countByAgent.get(a.id) ?? 0,
    lastAssignedAt: toDate(lastByAgent.get(a.id)),
  }))
}

async function loadActiveRules(): Promise<Rule[]> {
  const rules = await prisma.routingRule.findMany({
    where: { isActive: true },
    orderBy: { priority: 'asc' },
  })
  return rules.map((r) => ({
    id: r.id,
    name: r.name,
    priority: r.priority,
    matchCategory: r.matchCategory,
    matchKeywords: r.matchKeywords,
    matchPriority: r.matchPriority,
    assignDepartment: r.assignDepartment,
    assignToUserId: r.assignToUserId,
    setPriority: r.setPriority,
    isActive: r.isActive,
  }))
}

async function loadSlaPolicy(priority: Priority) {
  return prisma.slaPolicy.findFirst({
    where: { priority, isActive: true },
  })
}

// ---------------------------------------------------------------- create

/**
 * Raise a ticket, running the full automation pipeline: classify (when the
 * caller did not decide), route, compute SLA deadlines, allocate a ticket
 * number, and write the audit trail.
 */
export async function createTicket(input: CreateTicketInput, user: SessionUser) {
  if (!can(user.role, 'ticket:create')) {
    throw new AuthError('You are not allowed to raise tickets', 403)
  }

  // 1. Classification — only fills gaps the caller left. A user who picked a
  //    category keeps it; we still classify to record the confidence, but we
  //    do not overrule an explicit human choice.
  const classification = classifyTicket(input.title, input.description)
  const usedClassifier = !input.category || !input.priority

  const category: Category = input.category ?? classification.category
  let priority: Priority = input.priority ?? classification.priority

  // 2. Routing over the active rule set + live agent loads.
  const [rules, agents] = await Promise.all([loadActiveRules(), loadAgentLoads()])
  const routing = routeTicket(
    { category, priority, title: input.title, description: input.description },
    rules,
    agents,
  )

  // A rule may override priority (e.g. "anything mentioning 'outage' is HIGH").
  if (routing.priority) priority = routing.priority

  // 3. SLA targets for the *final* priority.
  const policy = await loadSlaPolicy(priority)
  const createdAt = new Date()
  const targets = policy
    ? computeSlaTargets(createdAt, {
        firstResponseMins: policy.firstResponseMins,
        resolutionMins: policy.resolutionMins,
        businessHoursOnly: policy.businessHoursOnly,
      })
    : null

  const autoClassified = usedClassifier && classification.autoClassified

  // 4 + 5. Allocate the ticket number and write the ticket plus its audit
  // events. The number is derived OUTSIDE the transaction. Reading inside it meant
  // every concurrent create held SQLite's single write lock across a read plus
  // an insert, and they timed out waiting on each other rather than colliding
  // cleanly. Now the transaction contains only writes, so the lock is held for
  // as short a time as possible, and a genuine collision surfaces as a unique
  // violation that the retry loop below handles.
  const attempt = async () => {
    const latest = await prisma.ticket.findFirst({
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    })
    const ticketNumber = nextTicketNumber(latest?.ticketNumber ?? null, createdAt)

    return prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          ticketNumber,
          title: input.title,
          description: input.description,
          category,
          priority,
          status: 'OPEN',
          channel: input.channel,
          department: routing.department,
          createdById: user.id,
          assignedToId: routing.assignedToId,
          slaPolicyId: policy?.id ?? null,
          firstResponseDueAt: targets?.firstResponseDueAt ?? null,
          resolutionDueAt: targets?.resolutionDueAt ?? null,
          autoClassified,
          classifierConfidence: usedClassifier ? classification.confidence : null,
          autoRouted: routing.autoRouted,
          matchedRuleId: routing.matchedRuleId,
          createdAt,
        },
        include: {
          createdBy: { select: USER_SELECT },
          assignedTo: { select: USER_SELECT },
          slaPolicy: true,
        },
      })

      const events: Prisma.TicketEventCreateManyInput[] = [
        {
          ticketId: ticket.id,
          actorId: user.id,
          type: 'CREATED',
          toValue: ticket.ticketNumber,
          metadata: JSON.stringify({ channel: ticket.channel }),
        },
      ]

      if (autoClassified) {
        events.push({
          ticketId: ticket.id,
          actorId: null,
          type: 'AUTO_CLASSIFIED',
          toValue: category,
          metadata: JSON.stringify({
            category,
            priority,
            confidence: classification.confidence,
            matchedTerms: classification.matchedTerms,
          }),
        })
      }

      if (routing.assignedToId) {
        events.push({
          ticketId: ticket.id,
          actorId: null,
          type: 'ASSIGNED',
          toValue: routing.assignedToId,
          metadata: JSON.stringify({
            department: routing.department,
            matchedRuleId: routing.matchedRuleId,
            autoRouted: routing.autoRouted,
          }),
        })
      }

      await tx.ticketEvent.createMany({ data: events })

      return ticket
    })
  }

  // Concurrent creates can read the same "latest" row and derive the same
  // candidate number; the UNIQUE constraint lets exactly one through and the
  // losers retry against the now-updated maximum. Jitter keeps a burst from
  // re-colliding in lockstep.
  //
  // The serialisation itself is handled in lib/db.ts (SQLite is a single
  // writer, so the pool is sized to match and given room to queue). Verified:
  // 30 parallel creates all succeed with unique numbers.
  const MAX_ATTEMPTS = 5

  let lastError: unknown
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      return await attempt()
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      lastError = e
      await new Promise((r) => setTimeout(r, 5 + Math.random() * 15))
    }
  }

  throw lastError
}

// ---------------------------------------------------------------- list

export interface ListTicketsResult {
  tickets: Awaited<ReturnType<typeof queryTickets>>
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function queryTickets(args: Prisma.TicketFindManyArgs) {
  return prisma.ticket.findMany({
    ...args,
    include: {
      createdBy: { select: USER_SELECT },
      assignedTo: { select: USER_SELECT },
    },
  })
}

const SORT_ORDERS: Record<
  TicketFilterInput['sort'],
  Prisma.TicketOrderByWithRelationInput[]
> = {
  newest: [{ createdAt: 'desc' }],
  oldest: [{ createdAt: 'asc' }],
  // SQLite sorts the priority *string*, so rank by hand: CRITICAL first.
  priority: [{ createdAt: 'desc' }],
  due: [{ resolutionDueAt: 'asc' }, { createdAt: 'desc' }],
}

const PRIORITY_SORT_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
}

/**
 * Role-scoped, filtered, searched, sorted and paginated ticket list.
 *
 * The role scope is applied as a WHERE clause, not a post-filter: an employee
 * literally cannot page past their own tickets.
 */
export async function listTickets(
  filter: TicketFilterInput,
  user: SessionUser,
): Promise<ListTicketsResult> {
  const where: Prisma.TicketWhereInput = {}

  // --- role scoping (security boundary)
  if (!can(user.role, 'ticket:readAll')) {
    where.createdById = user.id
  } else if (filter.createdById) {
    where.createdById = filter.createdById
  }

  if (filter.status) where.status = filter.status
  if (filter.priority) where.priority = filter.priority
  if (filter.category) where.category = filter.category
  if (filter.department) where.department = filter.department
  if (filter.assignedToId) {
    where.assignedToId =
      filter.assignedToId === 'unassigned' ? null : filter.assignedToId
  }
  if (filter.slaBreached !== undefined) where.slaBreached = filter.slaBreached

  if (filter.search) {
    // insensitiveContains adapts to the configured datasource: SQLite's LIKE
    // is already case-insensitive, Postgres needs mode: 'insensitive'.
    // Without this, search silently becomes case-sensitive on deployment.
    const term = insensitiveContains(filter.search)
    where.OR = [{ title: term }, { description: term }, { ticketNumber: term }]
  }

  const skip = (filter.page - 1) * filter.pageSize

  // Priority sorting needs a rank the DB does not have. For that one mode we
  // page in memory over the filtered set; every other mode pages in SQL.
  if (filter.sort === 'priority') {
    const [all, total] = await Promise.all([
      queryTickets({ where, orderBy: [{ createdAt: 'desc' }] }),
      prisma.ticket.count({ where }),
    ])
    const sorted = all.sort((a, b) => {
      const ra = PRIORITY_SORT_RANK[a.priority] ?? 99
      const rb = PRIORITY_SORT_RANK[b.priority] ?? 99
      if (ra !== rb) return ra - rb
      return b.createdAt.getTime() - a.createdAt.getTime()
    })
    return {
      tickets: sorted.slice(skip, skip + filter.pageSize),
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
    }
  }

  const [tickets, total] = await Promise.all([
    queryTickets({
      where,
      orderBy: SORT_ORDERS[filter.sort],
      skip,
      take: filter.pageSize,
    }),
    prisma.ticket.count({ where }),
  ])

  return {
    tickets,
    total,
    page: filter.page,
    pageSize: filter.pageSize,
    totalPages: Math.max(1, Math.ceil(total / filter.pageSize)),
  }
}

// ---------------------------------------------------------------- read one

/**
 * A single ticket with its full timeline.
 *
 * Internal worknotes are excluded in the SQL WHERE clause for readers without
 * `comment:readInternal` — filtering after the fetch would mean the bytes had
 * already left the database, and any future serialisation bug would leak them.
 */
export async function getTicket(id: string, user: SessionUser) {
  const showInternal = can(user.role, 'comment:readInternal')

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      createdBy: { select: USER_SELECT },
      assignedTo: { select: USER_SELECT },
      slaPolicy: true,
      attachments: {
        orderBy: { createdAt: 'asc' },
        include: { uploadedBy: { select: USER_SELECT } },
      },
      comments: {
        where: showInternal ? {} : { isInternal: false },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: USER_SELECT } },
      },
      events: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: USER_SELECT } },
      },
    },
  })

  if (!ticket) throw new AuthError('Ticket not found', 404)
  if (!canViewTicket(user, ticket)) {
    throw new AuthError('You are not allowed to view this ticket', 403)
  }

  return ticket
}

/** View-access check without the expensive includes. */
async function requireViewableTicket(id: string, user: SessionUser) {
  const ticket = await prisma.ticket.findUnique({ where: { id } })
  if (!ticket) throw new AuthError('Ticket not found', 404)
  if (!canViewTicket(user, ticket)) {
    throw new AuthError('You are not allowed to view this ticket', 403)
  }
  return ticket
}

// ---------------------------------------------------------------- update

/**
 * Apply a partial update.
 *
 * Every field is authorised separately — an employee may reopen their own
 * ticket but may not reassign it — and every accepted change writes its own
 * immutable audit event capturing from/to.
 */
export async function updateTicket(
  id: string,
  input: UpdateTicketInput,
  user: SessionUser,
) {
  const ticket = await requireViewableTicket(id, user)

  const data: Prisma.TicketUpdateInput = {}
  const events: Prisma.TicketEventCreateManyInput[] = []
  const now = new Date()

  const audit = (
    type: string,
    fromValue: string | null,
    toValue: string | null,
    metadata?: unknown,
  ) => {
    events.push({
      ticketId: ticket.id,
      actorId: user.id,
      type,
      fromValue,
      toValue,
      metadata: metadata === undefined ? null : JSON.stringify(metadata),
    })
  }

  // --- status -------------------------------------------------------
  if (input.status !== undefined && input.status !== ticket.status) {
    const next = input.status as Status
    const reopening = next === 'REOPENED' || next === 'OPEN'
    const wasTerminal = ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'

    // Requesters get exactly one status power: reopening their own resolved
    // ticket. Everything else needs ticket:changeStatus.
    const allowed = can(user.role, 'ticket:changeStatus')
      ? true
      : reopening && wasTerminal && can(user.role, 'ticket:reopen')

    if (!allowed) {
      throw new AuthError('You are not allowed to change the status', 403)
    }

    data.status = next
    audit('STATUS_CHANGED', ticket.status, next)

    // Leaving ON_HOLD: credit the elapsed hold time back to the SLA clock.
    if (ticket.status === 'ON_HOLD' && next !== 'ON_HOLD') {
      const since = toDate(ticket.onHoldSince)
      if (since) {
        data.holdMinutes = ticket.holdMinutes + minutesBetween(since, now)
      }
      data.onHoldSince = null
    }

    // Entering ON_HOLD: stamp the moment the clock stopped.
    if (next === 'ON_HOLD' && ticket.status !== 'ON_HOLD') {
      data.onHoldSince = now
    }

    if (next === 'RESOLVED') {
      data.resolvedAt = now
      audit('RESOLVED', null, null)
    }

    if (next === 'CLOSED') {
      data.closedAt = now
      // Closing straight from an unresolved state still records a resolution
      // moment, otherwise MTTR silently ignores the ticket.
      if (!ticket.resolvedAt) data.resolvedAt = now
      audit('CLOSED', null, null)
    }

    if (next === 'REOPENED') {
      data.resolvedAt = null
      data.closedAt = null
      audit('REOPENED', ticket.status, next)
    }
  }

  // --- priority -----------------------------------------------------
  let priorityChangedTo: Priority | null = null
  if (input.priority !== undefined && input.priority !== ticket.priority) {
    if (!can(user.role, 'ticket:changePriority')) {
      throw new AuthError('You are not allowed to change the priority', 403)
    }
    data.priority = input.priority
    priorityChangedTo = input.priority as Priority
    audit('PRIORITY_CHANGED', ticket.priority, input.priority)
  }

  // --- category -----------------------------------------------------
  if (input.category !== undefined && input.category !== ticket.category) {
    if (!can(user.role, 'ticket:changeCategory')) {
      throw new AuthError('You are not allowed to change the category', 403)
    }
    data.category = input.category
    audit('CATEGORY_CHANGED', ticket.category, input.category)
  }

  // --- department ---------------------------------------------------
  if (input.department !== undefined && input.department !== ticket.department) {
    if (!can(user.role, 'ticket:changeDepartment')) {
      throw new AuthError('You are not allowed to change the department', 403)
    }
    data.department = input.department as Department
    audit('STATUS_CHANGED', ticket.department, input.department, {
      field: 'department',
    })
  }

  // --- assignee -----------------------------------------------------
  if (
    input.assignedToId !== undefined &&
    (input.assignedToId ?? null) !== ticket.assignedToId
  ) {
    if (!can(user.role, 'ticket:assign')) {
      throw new AuthError('You are not allowed to assign tickets', 403)
    }

    const nextAssignee = input.assignedToId ?? null
    if (nextAssignee) {
      const assignee = await prisma.user.findUnique({
        where: { id: nextAssignee },
        select: { id: true, role: true, isActive: true },
      })
      if (!assignee || !assignee.isActive) {
        throw new AuthError('That assignee does not exist or is inactive', 400)
      }
      if (assignee.role === 'EMPLOYEE') {
        throw new AuthError('Tickets can only be assigned to agents or admins', 400)
      }
    }

    data.assignedTo = nextAssignee
      ? { connect: { id: nextAssignee } }
      : { disconnect: true }

    audit(
      ticket.assignedToId ? 'REASSIGNED' : 'ASSIGNED',
      ticket.assignedToId,
      nextAssignee,
    )
  }

  // --- SLA recomputation on priority change -------------------------
  if (priorityChangedTo) {
    const policy = await loadSlaPolicy(priorityChangedTo)
    if (policy) {
      const targets = recomputeSlaTargets(
        ticket.createdAt,
        {
          firstResponseMins: policy.firstResponseMins,
          resolutionMins: policy.resolutionMins,
          businessHoursOnly: policy.businessHoursOnly,
        },
        ticket.holdMinutes,
      )
      data.slaPolicy = { connect: { id: policy.id } }
      data.firstResponseDueAt = targets.firstResponseDueAt
      data.resolutionDueAt = targets.resolutionDueAt
    }
  }

  if (Object.keys(data).length === 0) {
    // Nothing actually differed from the stored row — return it unchanged
    // rather than writing an empty audit entry.
    return getTicket(id, user)
  }

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: ticket.id }, data })
    if (events.length > 0) await tx.ticketEvent.createMany({ data: events })
  })

  return getTicket(id, user)
}

// ---------------------------------------------------------------- comments

export interface AddCommentInput {
  body: string
  isInternal: boolean
}

export async function addComment(
  ticketId: string,
  input: AddCommentInput,
  user: SessionUser,
) {
  const ticket = await requireViewableTicket(ticketId, user)

  if (!can(user.role, 'comment:create')) {
    throw new AuthError('You are not allowed to comment', 403)
  }
  if (input.isInternal && !can(user.role, 'comment:createInternal')) {
    throw new AuthError('You are not allowed to add internal notes', 403)
  }

  const now = new Date()

  // A public reply from anyone other than the requester is the "first
  // response" the SLA measures. Internal worknotes never count — the user
  // has not heard from anyone yet.
  const isFirstResponse =
    !input.isInternal &&
    !ticket.firstRespondedAt &&
    ticket.createdById !== user.id

  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        body: input.body,
        isInternal: input.isInternal,
        createdAt: now,
      },
      include: { author: { select: USER_SELECT } },
    })

    if (isFirstResponse) {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { firstRespondedAt: now },
      })
    }

    await tx.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        actorId: user.id,
        type: input.isInternal ? 'INTERNAL_NOTE' : 'COMMENTED',
        metadata: JSON.stringify({
          commentId: created.id,
          firstResponse: isFirstResponse,
        }),
      },
    })

    return created
  })

  return comment
}

// ---------------------------------------------------------------- rating

export interface RateTicketInput {
  rating: number
  comment?: string
}

export async function rateTicket(
  ticketId: string,
  input: RateTicketInput,
  user: SessionUser,
) {
  const ticket = await requireViewableTicket(ticketId, user)

  if (!can(user.role, 'ticket:rate') || !canRateTicket(user, ticket)) {
    throw new AuthError('Only the requester can rate this ticket', 403)
  }

  if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
    throw new AuthError(
      'A ticket can only be rated once it has been resolved',
      400,
    )
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        satisfactionRating: input.rating,
        satisfactionComment: input.comment ?? null,
      },
      include: {
        createdBy: { select: USER_SELECT },
        assignedTo: { select: USER_SELECT },
      },
    })

    await tx.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        actorId: user.id,
        type: 'RATED',
        fromValue: ticket.satisfactionRating?.toString() ?? null,
        toValue: String(input.rating),
        metadata: JSON.stringify({ comment: input.comment ?? null }),
      },
    })

    return t
  })

  return updated
}

// ---------------------------------------------------------------- duplicates

/**
 * The requester's own open tickets from the last 7 days — the corpus
 * `findDuplicates` scores a draft against.
 */
export async function recentOpenTicketsFor(userId: string) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  return prisma.ticket.findMany({
    where: {
      createdById: userId,
      status: { in: OPEN_STATUSES },
      createdAt: { gte: since },
    },
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      description: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export { OPEN_STATUSES, USER_SELECT }
