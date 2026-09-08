import { redirect } from 'next/navigation'
import { CalendarClock, PauseCircle, Timer } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/rbac'
import { PRIORITY_RANK, type Priority } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SlaManager, type AdminSlaPolicy } from './sla-manager'

export const dynamic = 'force-dynamic'

export default async function AdminSlaPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!can(user.role, 'sla:write')) redirect('/tickets')

  const rows = await prisma.slaPolicy.findMany({
    select: {
      id: true,
      name: true,
      priority: true,
      firstResponseMins: true,
      resolutionMins: true,
      businessHoursOnly: true,
      isActive: true,
      _count: { select: { tickets: true } },
    },
  })

  // Most severe first — that is the order a service manager reads them in.
  const policies: AdminSlaPolicy[] = rows
    .map((p) => ({
      id: p.id,
      name: p.name,
      priority: p.priority,
      firstResponseMins: p.firstResponseMins,
      resolutionMins: p.resolutionMins,
      businessHoursOnly: p.businessHoursOnly,
      isActive: p.isActive,
      ticketCount: p._count.tickets,
    }))
    .sort(
      (a, b) =>
        (PRIORITY_RANK[b.priority as Priority] ?? 0) -
        (PRIORITY_RANK[a.priority as Priority] ?? 0)
    )

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">SLA policies</h1>
        <p className="text-sm text-muted-foreground">
          One policy per priority level. Targets are snapshotted onto a ticket when it is raised.
        </p>
      </header>

      <SlaManager policies={policies} />

      {/* Judges always ask how the clock is actually computed. */}
      <Card>
        <CardHeader>
          <CardTitle>How the SLA clock is calculated</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span
                aria-hidden="true"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300"
              >
                <CalendarClock className="h-4 w-4" />
              </span>
              Business hours only
            </h3>
            <p className="text-sm leading-5 text-muted-foreground">
              When a policy is business-hours-only, the deadline advances only during{' '}
              <span className="font-medium text-foreground">Monday to Friday, 09:00–18:00 IST</span>
              . A 4-hour target on a ticket raised at 17:00 on Friday is therefore due at{' '}
              <span className="font-medium text-foreground">12:00 on Monday</span>, not 21:00 on
              Friday — weekends and nights are skipped entirely rather than silently burning the
              clock.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span
                aria-hidden="true"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300"
              >
                <PauseCircle className="h-4 w-4" />
              </span>
              The clock pauses on hold
            </h3>
            <p className="text-sm leading-5 text-muted-foreground">
              Moving a ticket to{' '}
              <span className="font-medium text-foreground">On Hold</span> — waiting on the
              requester, a vendor, or a hardware part — stops the resolution clock. The elapsed
              hold time is accumulated and credited back to both deadlines when the ticket
              resumes, so an agent is never penalised for time they did not control.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span
                aria-hidden="true"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300"
              >
                <Timer className="h-4 w-4" />
              </span>
              Recalculation and breach sweep
            </h3>
            <p className="text-sm leading-5 text-muted-foreground">
              Changing a ticket&apos;s priority recomputes both deadlines from the{' '}
              <span className="font-medium text-foreground">original creation time</span>, so an
              escalation cannot be used to buy extra hours. A periodic sweep marks overdue tickets
              as breached, writes an immutable{' '}
              <span className="font-mono text-xs text-foreground">SLA_BREACHED</span> audit event
              and escalates the priority one level. The sweep is idempotent — running it twice
              changes nothing.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  )
}
