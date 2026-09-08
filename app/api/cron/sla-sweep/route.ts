import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { AuthError, getCurrentUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { escalatePriority, type Priority } from '@/lib/constants'
import { recomputeSlaTargets } from '@/lib/automation/sla'
import { OPEN_STATUSES } from '@/lib/services/ticket-service'
import { handleApiError, json } from '@/lib/api-utils'

/**
 * Mark newly-breached tickets and escalate them.
 *
 * Idempotent by construction: the query only selects tickets with
 * `slaBreached: false`, and the first thing the sweep does is flip that flag.
 * Hitting this repeatedly — which a cron scheduler will — is therefore safe
 * and sweeps nothing the second time.
 *
 * Idempotence is not access control, though. The *first* call permanently
 * flips breach flags, escalates priorities and writes undeletable audit
 * events across the whole open queue — so this endpoint requires either a
 * matching `x-cron-secret` header (how a scheduler calls it) or an
 * authenticated ADMIN session (how a person triggers it during a demo).
 * It is never anonymous, and it is POST-only so a stray <img> tag on some
 * other site cannot fire it.
 */
export async function POST(req: Request) {
  try {
    const expected = process.env.CRON_SECRET
    const provided = req.headers.get('x-cron-secret')

    if (expected && provided === expected) {
      // Authorised as the scheduler.
    } else if (provided && expected && provided !== expected) {
      throw new AuthError('Invalid cron secret', 401)
    } else {
      // No valid secret: fall back to requiring a human admin.
      const user = await getCurrentUser()
      if (!user) {
        throw new AuthError(
          'This endpoint requires an admin session or a valid x-cron-secret header',
          401,
        )
      }
      if (!can(user.role, 'sla:write')) {
        throw new AuthError('Only an administrator may run the SLA sweep', 403)
      }
    }

    const now = new Date()

    const due = await prisma.ticket.findMany({
      where: {
        slaBreached: false,
        status: { in: OPEN_STATUSES },
        resolutionDueAt: { not: null, lt: now },
      },
      select: {
        id: true,
        priority: true,
        createdAt: true,
        holdMinutes: true,
        resolutionDueAt: true,
      },
    })

    let swept = 0

    for (const ticket of due) {
      const from = ticket.priority as Priority
      const to = escalatePriority(from)
      const escalated = to !== from

      // A breach means the current policy's window was wrong for this ticket;
      // after escalating, recompute against the new level's policy so the
      // dashboard countdown reflects the priority the ticket now carries.
      let slaUpdate: {
        slaPolicyId?: string
        firstResponseDueAt?: Date
        resolutionDueAt?: Date
      } = {}

      if (escalated) {
        const policy = await prisma.slaPolicy.findFirst({
          where: { priority: to, isActive: true },
        })
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
          slaUpdate = {
            slaPolicyId: policy.id,
            firstResponseDueAt: targets.firstResponseDueAt,
            resolutionDueAt: targets.resolutionDueAt,
          }
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: {
            slaBreached: true,
            ...(escalated ? { priority: to } : {}),
            ...slaUpdate,
          },
        })

        const events: Prisma.TicketEventCreateManyInput[] = [
          {
            ticketId: ticket.id,
            actorId: null,
            type: 'SLA_BREACHED',
            fromValue: null,
            toValue: from,
            metadata: JSON.stringify({
              resolutionDueAt: ticket.resolutionDueAt,
              detectedAt: now,
            }),
          },
        ]

        if (escalated) {
          events.push({
            ticketId: ticket.id,
            actorId: null,
            type: 'ESCALATED',
            fromValue: from,
            toValue: to,
            metadata: JSON.stringify({ reason: 'SLA_BREACH' }),
          })
        }

        await tx.ticketEvent.createMany({ data: events })
      })

      swept++
    }

    return json({ swept })
  } catch (e) {
    return handleApiError(e)
  }
}

// Deliberately not implemented. The sweep mutates every overdue ticket, and
// a state-changing GET can be fired cross-site by a plain <img> tag. Vercel
// Cron issues GETs by default, so vercel.json is configured to POST instead.
export function GET() {
  return json(
    { error: 'Use POST for the SLA sweep' },
    405,
  )
}
