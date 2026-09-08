/**
 * Deterministic seed. A fixed PRNG seed means the dashboard looks identical on
 * every machine and every run — no "it looked different in rehearsal" surprises
 * during a live demo.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { TICKET_TEMPLATES, KB_ARTICLES, COMMENT_TEMPLATES } from './seed-data'

const prisma = new PrismaClient()

// ---------------------------------------------------------------- PRNG
// Mulberry32 — small, fast, deterministic.
function makeRng(seed: number) {
  let a = seed
  return function rng(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = makeRng(20250908)

const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]!
const randInt = (min: number, max: number) => Math.floor(rng() * (max - min + 1)) + min
const chance = (p: number) => rng() < p

// ---------------------------------------------------------------- helpers

/** Business-hours-aware timestamp generator so ticket arrival looks human. */
function workingTimestamp(daysAgo: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  // Weekend arrivals are rare in a government office; nudge them to Monday.
  const day = d.getDay()
  if (day === 0) d.setDate(d.getDate() + 1)
  if (day === 6) d.setDate(d.getDate() + 2)
  // Arrival curve: morning peak around 10-11, secondary peak after lunch.
  const hourPool = [9, 10, 10, 10, 11, 11, 12, 14, 14, 15, 15, 16, 17]
  d.setHours(pick(hourPool), randInt(0, 59), randInt(0, 59), 0)
  return d
}

function addMinutes(d: Date, mins: number): Date {
  return new Date(d.getTime() + mins * 60000)
}

const SLA_MINUTES: Record<string, { first: number; resolve: number }> = {
  CRITICAL: { first: 15, resolve: 240 },
  HIGH: { first: 60, resolve: 480 },
  MEDIUM: { first: 240, resolve: 1440 },
  LOW: { first: 480, resolve: 4320 },
}

async function main() {
  console.log('  Seeding Smart Helpdesk database...\n')

  // Wipe in FK-safe order so re-seeding is idempotent.
  await prisma.ticketEvent.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.attachment.deleteMany()
  await prisma.ticket.deleteMany()
  await prisma.kbArticle.deleteMany()
  await prisma.routingRule.deleteMany()
  await prisma.slaPolicy.deleteMany()
  await prisma.user.deleteMany()

  // ------------------------------------------------------------- users
  const password = await bcrypt.hash('password123', 10)

  const admin = await prisma.user.create({
    data: {
      email: 'admin@mop.gov.in',
      passwordHash: password,
      name: 'Rajesh Verma',
      role: 'ADMIN',
      department: 'IT_INFRA',
      employeeCode: 'MOP-1001',
      phone: '011-23456701',
    },
  })

  const agentUser = await prisma.user.create({
    data: {
      email: 'agent@mop.gov.in',
      passwordHash: password,
      name: 'Priya Nair',
      role: 'AGENT',
      department: 'IT_INFRA',
      employeeCode: 'MOP-2001',
      phone: '011-23456702',
    },
  })

  const employeeUser = await prisma.user.create({
    data: {
      email: 'employee@mop.gov.in',
      passwordHash: password,
      name: 'Amit Sharma',
      role: 'EMPLOYEE',
      department: 'APPLICATIONS',
      employeeCode: 'MOP-3001',
      phone: '011-23456703',
    },
  })

  const otherAgents = await Promise.all(
    [
      { name: 'Sunil Kumar', email: 'sunil.kumar@mop.gov.in', department: 'NETWORK_OPS', code: 'MOP-2002' },
      { name: 'Meena Iyer', email: 'meena.iyer@mop.gov.in', department: 'APPLICATIONS', code: 'MOP-2003' },
      { name: 'Arjun Reddy', email: 'arjun.reddy@mop.gov.in', department: 'SECURITY', code: 'MOP-2004' },
      { name: 'Kavita Joshi', email: 'kavita.joshi@mop.gov.in', department: 'IT_INFRA', code: 'MOP-2005' },
      { name: 'Deepak Mishra', email: 'deepak.mishra@mop.gov.in', department: 'NETWORK_OPS', code: 'MOP-2006' },
      { name: 'Anjali Gupta', email: 'anjali.gupta@mop.gov.in', department: 'APPLICATIONS', code: 'MOP-2007' },
      { name: 'Vikram Singh', email: 'vikram.singh@mop.gov.in', department: 'GENERAL', code: 'MOP-2008' },
    ].map((a) =>
      prisma.user.create({
        data: {
          email: a.email,
          passwordHash: password,
          name: a.name,
          role: 'AGENT',
          department: a.department,
          employeeCode: a.code,
        },
      }),
    ),
  )

  const employees = await Promise.all(
    [
      { name: 'Suresh Patel', email: 'suresh.patel@mop.gov.in', department: 'GENERAL', code: 'MOP-3002' },
      { name: 'Lakshmi Menon', email: 'lakshmi.menon@mop.gov.in', department: 'APPLICATIONS', code: 'MOP-3003' },
      { name: 'Ravi Chandran', email: 'ravi.chandran@mop.gov.in', department: 'GENERAL', code: 'MOP-3004' },
      { name: 'Neha Bansal', email: 'neha.bansal@mop.gov.in', department: 'GENERAL', code: 'MOP-3005' },
      { name: 'Manoj Tiwari', email: 'manoj.tiwari@mop.gov.in', department: 'GENERAL', code: 'MOP-3006' },
      { name: 'Sanjay Dubey', email: 'sanjay.dubey@mop.gov.in', department: 'GENERAL', code: 'MOP-3007' },
      { name: 'Pooja Rani', email: 'pooja.rani@mop.gov.in', department: 'GENERAL', code: 'MOP-3008' },
      { name: 'Harish Rao', email: 'harish.rao@mop.gov.in', department: 'GENERAL', code: 'MOP-3009' },
    ].map((e) =>
      prisma.user.create({
        data: {
          email: e.email,
          passwordHash: password,
          name: e.name,
          role: 'EMPLOYEE',
          department: e.department,
          employeeCode: e.code,
        },
      }),
    ),
  )

  const allAgents = [agentUser, ...otherAgents]
  const allRequesters = [employeeUser, ...employees]
  console.log(`  Users: ${allAgents.length + allRequesters.length + 1}`)

  // -------------------------------------------------------- SLA policies
  const policies = await Promise.all(
    (
      [
        { name: 'Critical Priority SLA', priority: 'CRITICAL', firstResponseMins: 15, resolutionMins: 240 },
        { name: 'High Priority SLA', priority: 'HIGH', firstResponseMins: 60, resolutionMins: 480 },
        { name: 'Medium Priority SLA', priority: 'MEDIUM', firstResponseMins: 240, resolutionMins: 1440 },
        { name: 'Low Priority SLA', priority: 'LOW', firstResponseMins: 480, resolutionMins: 4320 },
      ] as const
    ).map((p) =>
      prisma.slaPolicy.create({ data: { ...p, businessHoursOnly: true, isActive: true } }),
    ),
  )
  const policyByPriority = Object.fromEntries(policies.map((p) => [p.priority, p]))
  console.log(`  SLA policies: ${policies.length}`)

  // ------------------------------------------------------- routing rules
  const rules = await Promise.all([
    prisma.routingRule.create({
      data: {
        name: 'Security incidents to InfoSec team',
        priority: 10,
        matchCategory: 'SECURITY',
        matchKeywords: 'phishing,malware,virus,breach,unauthorised,unauthorized,hacked,ransomware',
        assignDepartment: 'SECURITY',
        assignToUserId: otherAgents[2]!.id,
        setPriority: 'HIGH',
        isActive: true,
      },
    }),
    prisma.routingRule.create({
      data: {
        name: 'Network and VPN issues to Network Operations',
        priority: 20,
        matchCategory: 'NETWORK',
        matchKeywords: 'vpn,wifi,wi-fi,internet,lan,switch,router,dns,connectivity',
        assignDepartment: 'NETWORK_OPS',
        isActive: true,
      },
    }),
    prisma.routingRule.create({
      data: {
        name: 'SAP and ERP issues to Applications team',
        priority: 30,
        matchCategory: 'SAP_ERP',
        matchKeywords: 'sap,erp,tcode,t-code,module,abap,workflow',
        assignDepartment: 'APPLICATIONS',
        isActive: true,
      },
    }),
    prisma.routingRule.create({
      data: {
        name: 'Critical tickets to senior infrastructure engineer',
        priority: 5,
        matchPriority: 'CRITICAL',
        matchKeywords: '',
        assignDepartment: 'IT_INFRA',
        assignToUserId: agentUser.id,
        isActive: true,
      },
    }),
    prisma.routingRule.create({
      data: {
        name: 'Hardware requests to IT Infrastructure',
        priority: 40,
        matchCategory: 'HARDWARE',
        matchKeywords: 'laptop,desktop,printer,monitor,ups,keyboard,mouse,toner',
        assignDepartment: 'IT_INFRA',
        isActive: true,
      },
    }),
    prisma.routingRule.create({
      data: {
        name: 'Account and access requests to IT Infrastructure',
        priority: 50,
        matchCategory: 'ACCESS',
        matchKeywords: 'password,account,login,access,unlock,permission',
        assignDepartment: 'IT_INFRA',
        isActive: true,
      },
    }),
  ])
  console.log(`  Routing rules: ${rules.length}`)

  // ------------------------------------------------------- KB articles
  for (const art of KB_ARTICLES) {
    await prisma.kbArticle.create({
      data: {
        slug: art.slug,
        title: art.title,
        body: art.body,
        category: art.category,
        tags: art.tags,
        authorId: admin.id,
        isPublished: true,
        viewCount: randInt(20, 480),
        helpfulCount: randInt(5, 90),
        notHelpfulCount: randInt(0, 8),
        deflectionCount: randInt(2, 35),
      },
    })
  }
  console.log(`  KB articles: ${KB_ARTICLES.length}`)

  // ------------------------------------------------------------ tickets
  const TOTAL = 220
  const year = new Date().getFullYear()
  let sequence = 0
  let breachedCount = 0

  // Assignment counters drive a realistic (uneven) agent workload chart.
  const agentTicketCount = new Map<string, number>(allAgents.map((a) => [a.id, 0]))

  for (let i = 0; i < TOTAL; i++) {
    const tpl = pick(TICKET_TEMPLATES)
    sequence++
    const ticketNumber = `MOP-${year}-${String(sequence).padStart(5, '0')}`

    // Weight recent days more heavily so the volume chart trends upward.
    const daysAgo = chance(0.45) ? randInt(0, 20) : randInt(21, 89)
    const createdAt = workingTimestamp(daysAgo)

    const priority = tpl.priority
    const sla = SLA_MINUTES[priority]!
    const policy = policyByPriority[priority]!

    // Status mix: ~55% done, ~25% in flight, ~20% fresh.
    const roll = rng()
    let status: string
    if (daysAgo > 30) status = chance(0.9) ? 'CLOSED' : 'RESOLVED'
    else if (roll < 0.4) status = 'CLOSED'
    else if (roll < 0.55) status = 'RESOLVED'
    else if (roll < 0.75) status = 'IN_PROGRESS'
    else if (roll < 0.82) status = 'ON_HOLD'
    else if (roll < 0.88) status = 'REOPENED'
    else status = 'OPEN'

    const isTerminal = status === 'CLOSED' || status === 'RESOLVED'
    const isAssigned = status !== 'OPEN' || chance(0.5)

    // Prefer an agent from the ticket's department, load-balanced.
    const deptAgents = allAgents.filter((a) => a.department === tpl.department)
    const pool = deptAgents.length > 0 ? deptAgents : allAgents
    const assignee = isAssigned
      ? pool.reduce((best, a) =>
          (agentTicketCount.get(a.id) ?? 0) < (agentTicketCount.get(best.id) ?? 0) ? a : best,
        )
      : null
    if (assignee) agentTicketCount.set(assignee.id, (agentTicketCount.get(assignee.id) ?? 0) + 1)

    const requester = pick(allRequesters)

    const firstResponseDueAt = addMinutes(createdAt, sla.first)
    const resolutionDueAt = addMinutes(createdAt, sla.resolve)

    // ~12% breach rate keeps the compliance gauge honest and interesting.
    const willBreach = chance(0.12)
    const firstRespondedAt = isAssigned
      ? addMinutes(createdAt, willBreach ? sla.first + randInt(20, 240) : randInt(3, Math.max(4, sla.first - 5)))
      : null

    const resolvedAt = isTerminal
      ? addMinutes(createdAt, willBreach ? sla.resolve + randInt(60, 900) : randInt(30, Math.max(40, sla.resolve - 30)))
      : null
    const closedAt = status === 'CLOSED' && resolvedAt ? addMinutes(resolvedAt, randInt(60, 2880)) : null

    const slaBreached = willBreach && (isTerminal || status === 'IN_PROGRESS')
    if (slaBreached) breachedCount++

    const rated = status === 'CLOSED' && chance(0.65)

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title: tpl.title,
        description: tpl.description,
        category: tpl.category,
        priority,
        status,
        channel: chance(0.75) ? 'WEB' : pick(['EMAIL', 'PHONE', 'WALK_IN']),
        department: tpl.department,
        createdById: requester.id,
        assignedToId: assignee?.id ?? null,
        slaPolicyId: policy.id,
        firstResponseDueAt,
        resolutionDueAt,
        firstRespondedAt,
        slaBreached,
        holdMinutes: status === 'ON_HOLD' ? randInt(60, 600) : 0,
        onHoldSince: status === 'ON_HOLD' ? addMinutes(createdAt, randInt(30, 200)) : null,
        autoClassified: chance(0.8),
        classifierConfidence: chance(0.8) ? Number((0.4 + rng() * 0.55).toFixed(2)) : null,
        autoRouted: isAssigned && chance(0.85),
        resolvedAt,
        closedAt,
        satisfactionRating: rated ? (chance(0.75) ? randInt(4, 5) : randInt(2, 3)) : null,
        satisfactionComment: rated && chance(0.4) ? pick([
          'Quick resolution, thank you.',
          'Issue resolved but took longer than expected.',
          'Very helpful and professional support.',
          'Resolved satisfactorily.',
          'Good support, appreciate the follow-up.',
        ]) : null,
        createdAt,
        updatedAt: closedAt ?? resolvedAt ?? firstRespondedAt ?? createdAt,
      },
    })

    // ------------------------------------------------ events & comments
    const events: Array<{ type: string; at: Date; actorId: string | null; from?: string; to?: string }> = [
      { type: 'CREATED', at: createdAt, actorId: requester.id },
    ]
    if (ticket.autoClassified) {
      events.push({ type: 'AUTO_CLASSIFIED', at: createdAt, actorId: null, to: tpl.category })
    }
    if (assignee) {
      events.push({ type: 'ASSIGNED', at: addMinutes(createdAt, 2), actorId: null, to: assignee.name })
    }
    if (firstRespondedAt) {
      events.push({ type: 'COMMENTED', at: firstRespondedAt, actorId: assignee?.id ?? null })
    }
    if (status !== 'OPEN') {
      events.push({
        type: 'STATUS_CHANGED',
        at: addMinutes(createdAt, 30),
        actorId: assignee?.id ?? null,
        from: 'OPEN',
        to: 'IN_PROGRESS',
      })
    }
    if (slaBreached) {
      events.push({ type: 'SLA_BREACHED', at: resolutionDueAt, actorId: null, to: 'RESOLUTION' })
    }
    if (resolvedAt) {
      events.push({ type: 'RESOLVED', at: resolvedAt, actorId: assignee?.id ?? null, from: 'IN_PROGRESS', to: 'RESOLVED' })
    }
    if (closedAt) {
      events.push({ type: 'CLOSED', at: closedAt, actorId: requester.id, from: 'RESOLVED', to: 'CLOSED' })
    }
    if (status === 'REOPENED') {
      events.push({ type: 'REOPENED', at: addMinutes(createdAt, 2000), actorId: requester.id, from: 'RESOLVED', to: 'REOPENED' })
    }
    if (rated) {
      events.push({ type: 'RATED', at: closedAt ?? createdAt, actorId: requester.id, to: String(ticket.satisfactionRating) })
    }

    await prisma.ticketEvent.createMany({
      data: events.map((e) => ({
        ticketId: ticket.id,
        actorId: e.actorId,
        type: e.type,
        fromValue: e.from ?? null,
        toValue: e.to ?? null,
        createdAt: e.at,
      })),
    })

    // Conversation
    if (firstRespondedAt && assignee) {
      await prisma.comment.create({
        data: {
          ticketId: ticket.id,
          authorId: assignee.id,
          body: pick(COMMENT_TEMPLATES.agentFirst),
          isInternal: false,
          createdAt: firstRespondedAt,
        },
      })

      if (chance(0.55)) {
        await prisma.comment.create({
          data: {
            ticketId: ticket.id,
            authorId: assignee.id,
            body: pick(COMMENT_TEMPLATES.internalNotes),
            isInternal: true,
            createdAt: addMinutes(firstRespondedAt, 5),
          },
        })
      }

      if (chance(0.6)) {
        await prisma.comment.create({
          data: {
            ticketId: ticket.id,
            authorId: requester.id,
            body: pick(COMMENT_TEMPLATES.userReply),
            isInternal: false,
            createdAt: addMinutes(firstRespondedAt, randInt(20, 300)),
          },
        })
      }

      if (chance(0.5) && !isTerminal) {
        await prisma.comment.create({
          data: {
            ticketId: ticket.id,
            authorId: assignee.id,
            body: pick(COMMENT_TEMPLATES.agentProgress),
            isInternal: false,
            createdAt: addMinutes(firstRespondedAt, randInt(300, 900)),
          },
        })
      }

      if (resolvedAt) {
        await prisma.comment.create({
          data: {
            ticketId: ticket.id,
            authorId: assignee.id,
            body: pick(COMMENT_TEMPLATES.agentResolution),
            isInternal: false,
            createdAt: resolvedAt,
          },
        })
      }
    }
  }

  const counts = {
    tickets: await prisma.ticket.count(),
    comments: await prisma.comment.count(),
    events: await prisma.ticketEvent.count(),
    open: await prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'REOPENED'] } } }),
  }

  console.log(`  Tickets: ${counts.tickets}  (${counts.open} currently open)`)
  console.log(`  Comments: ${counts.comments}`)
  console.log(`  Audit events: ${counts.events}`)
  console.log(`  SLA breaches: ${breachedCount} (${Math.round((breachedCount / TOTAL) * 100)}%)`)

  console.log('\n  Demo accounts (password: password123)')
  console.log('    admin@mop.gov.in      Admin    - Rajesh Verma')
  console.log('    agent@mop.gov.in      Agent    - Priya Nair')
  console.log('    employee@mop.gov.in   Employee - Amit Sharma')
  console.log('\n  Seed complete.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
