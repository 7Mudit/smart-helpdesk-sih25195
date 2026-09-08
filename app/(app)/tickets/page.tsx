import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { Inbox, PlusCircle, SearchX } from 'lucide-react'
import { SlaBadge } from '@/components/sla-badge'
import { Avatar } from '@/components/ui/avatar'
import { Badge, PriorityBadge, StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getCurrentUser } from '@/lib/auth'
import {
  CATEGORIES,
  DEPARTMENTS,
  LABELS,
  PRIORITIES,
  STATUSES,
  type Category,
  type Department,
  type Priority,
  type Status,
} from '@/lib/constants'
import { prisma } from '@/lib/db'
import { insensitiveContains } from '@/lib/search-filter'
import { can } from '@/lib/rbac'
import { relativeTime } from '@/lib/utils'
import { TicketFilters } from './ticket-filters'

export const metadata: Metadata = { title: 'Tickets — Smart Helpdesk' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

type SearchParams = Record<string, string | string[] | undefined>

function one(params: SearchParams, key: string): string | undefined {
  const v = params[key]
  return Array.isArray(v) ? v[0] : v
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | undefined {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined
}

/** SQLite's LIKE is ASCII-case-insensitive, so `contains` needs no mode flag. */
function orderFor(sort: string | undefined): Prisma.TicketOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest':
      return [{ createdAt: 'asc' }]
    case 'priority':
      // Stored as text, so rank by hand: CRITICAL first.
      return [{ priority: 'asc' }, { createdAt: 'desc' }]
    case 'due':
      return [{ resolutionDueAt: 'asc' }]
    default:
      return [{ createdAt: 'desc' }]
  }
}

const PRIORITY_ORDER: Priority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const user = await getCurrentUser()
  // The group layout already redirected an anonymous visitor; this is a guard
  // for the type-checker.
  if (!user) return null

  const staff = can(user.role, 'ticket:readAll')

  const status = pick(one(params, 'status'), STATUSES)
  const priority = pick(one(params, 'priority'), PRIORITIES)
  const category = pick(one(params, 'category'), CATEGORIES)
  const department = pick(one(params, 'department'), DEPARTMENTS)
  const assignee = one(params, 'assignee')
  const search = (one(params, 'search') ?? '').trim().slice(0, 200)
  const sort = one(params, 'sort') ?? 'newest'
  const page = Math.max(1, Number.parseInt(one(params, 'page') ?? '1', 10) || 1)

  const where: Prisma.TicketWhereInput = {
    // SECURITY: employees are scoped to their own tickets in the query itself,
    // never by filtering the result set afterwards.
    ...(staff ? {} : { createdById: user.id }),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(category ? { category } : {}),
    ...(department ? { department } : {}),
    ...(staff && assignee
      ? assignee === 'unassigned'
        ? { assignedToId: null }
        : { assignedToId: assignee }
      : {}),
    // insensitiveContains adapts to the datasource: SQLite's LIKE is already
    // case-insensitive, Postgres needs mode: 'insensitive'. Building the
    // filter inline here would silently become case-sensitive on deployment.
    ...(search
      ? {
          OR: [
            { ticketNumber: insensitiveContains(search) },
            { title: insensitiveContains(search) },
            { description: insensitiveContains(search) },
          ],
        }
      : {}),
  }

  // Upper bound on rows pulled for the in-memory priority ranking. Ten pages
// deep is far past where anyone browses, and it keeps the query bounded as the
// ticket table grows.
const PRIORITY_SORT_CAP = 500

const sortByPriority = sort === 'priority'

  const [total, rows, agents] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy: orderFor(sort),
      // Priority is a text column, so alphabetical ordering would put CRITICAL
      // before LOW before MEDIUM. That one sort mode ranks in JS instead —
      // capped so an unfiltered admin view cannot pull the whole table.
      skip: sortByPriority ? 0 : (page - 1) * PAGE_SIZE,
      take: sortByPriority ? PRIORITY_SORT_CAP : PAGE_SIZE,
      select: {
        id: true,
        ticketNumber: true,
        title: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        resolutionDueAt: true,
        resolvedAt: true,
        slaBreached: true,
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    staff
      ? prisma.user.findMany({
          where: { role: { in: ['AGENT', 'ADMIN'] }, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
  ])

  const tickets = sortByPriority
    ? [...rows]
        .sort((a, b) => {
          const d =
            PRIORITY_ORDER.indexOf(a.priority as Priority) -
            PRIORITY_ORDER.indexOf(b.priority as Priority)
          return d !== 0 ? d : b.createdAt.getTime() - a.createdAt.getTime()
        })
        .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : rows

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const filtered = Boolean(
    status || priority || category || department || assignee || search
  )

  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {staff ? 'All Tickets' : 'My Tickets'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {total.toLocaleString('en-IN')} ticket{total === 1 ? '' : 's'}
            {filtered ? ' matching your filters' : staff ? ' across the service desk' : ' raised by you'}
          </p>
        </div>

        <Link
          href="/tickets/new"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <PlusCircle aria-hidden="true" className="h-4 w-4" />
          Raise a ticket
        </Link>
      </div>

      <TicketFilters assignees={agents} showAssignee={staff} />

      {tickets.length === 0 ? (
        <EmptyState
          icon={filtered ? <SearchX className="h-6 w-6" /> : <Inbox className="h-6 w-6" />}
          title={filtered ? 'No tickets match these filters' : 'No tickets yet'}
          description={
            filtered
              ? 'Try widening the filters or clearing the search term.'
              : staff
                ? 'Nothing has been raised on the service desk yet.'
                : 'When you raise an IT issue it will appear here with its SLA countdown.'
          }
          action={
            <Link
              href="/tickets/new"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <PlusCircle aria-hidden="true" className="h-4 w-4" />
              Raise a ticket
            </Link>
          }
        />
      ) : (
        <>
          <Table wrapperClassName="max-h-none">
            <caption className="sr-only">
              {staff ? 'All helpdesk tickets' : 'Tickets you have raised'}, page {page} of{' '}
              {pageCount}
            </caption>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead className="min-w-[16rem]">Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t) => (
                <TableRow key={t.id} className="group cursor-pointer">
                  <TableCell className="font-mono text-xs">
                    <Link
                      href={`/tickets/${t.id}`}
                      className="rounded font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {t.ticketNumber}
                    </Link>
                  </TableCell>

                  <TableCell>
                    <Link
                      href={`/tickets/${t.id}`}
                      className="flex flex-col gap-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="line-clamp-1 font-medium text-foreground group-hover:text-primary">
                        {t.title}
                      </span>
                      <Badge variant="secondary" className="w-fit">
                        {LABELS.category[t.category as Category] ?? t.category}
                      </Badge>
                    </Link>
                  </TableCell>

                  <TableCell>
                    <PriorityBadge priority={t.priority as Priority} />
                  </TableCell>

                  <TableCell>
                    <StatusBadge status={t.status as Status} />
                  </TableCell>

                  <TableCell>
                    {t.assignedTo ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={t.assignedTo.name} id={t.assignedTo.id} size="sm" />
                        <span className="whitespace-nowrap text-sm text-foreground">
                          {t.assignedTo.name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>

                  <TableCell>
                    <SlaBadge
                      dueAt={t.resolutionDueAt}
                      resolvedAt={t.resolvedAt}
                      breached={t.slaBreached}
                    />
                  </TableCell>

                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {relativeTime(t.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination page={page} pageCount={pageCount} total={total} params={params} />
        </>
      )}
    </div>
  )
}

function Pagination({
  page,
  pageCount,
  total,
  params,
}: {
  page: number
  pageCount: number
  total: number
  params: SearchParams
}) {
  function href(target: number): string {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (k === 'page' || v === undefined) continue
      next.set(k, Array.isArray(v) ? (v[0] ?? '') : v)
    }
    if (target > 1) next.set('page', String(target))
    const qs = next.toString()
    return qs ? `/tickets?${qs}` : '/tickets'
  }

  const from = (page - 1) * PAGE_SIZE + 1
  const to = Math.min(page * PAGE_SIZE, total)

  return (
    <nav
      aria-label="Ticket list pagination"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing <span className="font-medium text-foreground">{from}</span>–
        <span className="font-medium text-foreground">{to}</span> of{' '}
        <span className="font-medium text-foreground">{total.toLocaleString('en-IN')}</span>
      </p>

      <div className="flex items-center gap-2">
        <PageLink href={href(page - 1)} disabled={page <= 1} label="Previous page">
          Previous
        </PageLink>
        <span className="px-2 text-sm text-muted-foreground">
          Page {page} of {pageCount}
        </span>
        <PageLink href={href(page + 1)} disabled={page >= pageCount} label="Next page">
          Next
        </PageLink>
      </div>
    </nav>
  )
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  const base =
    'inline-flex h-9 items-center justify-center rounded-md border border-border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

  if (disabled) {
    return (
      <span aria-disabled="true" className={`${base} cursor-not-allowed bg-muted text-muted-foreground opacity-60`}>
        {children}
      </span>
    )
  }

  return (
    <Link href={href} aria-label={label} className={`${base} bg-card text-foreground hover:bg-accent`}>
      {children}
    </Link>
  )
}
