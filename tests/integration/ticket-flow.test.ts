/**
 * Integration tests against the real seeded database.
 *
 * These cover the boundaries that unit tests cannot: that role scoping is
 * actually applied in the SQL, that internal notes never leave the database
 * for an unauthorised reader, and that creating a ticket really does run the
 * whole automation pipeline and write the audit trail.
 *
 * Requires the seeded dev database (`npm run setup`).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/lib/db'
import {
  createTicket,
  getTicket,
  listTickets,
  addComment,
  updateTicket,
} from '@/lib/services/ticket-service'
import type { SessionUser } from '@/lib/auth'
import { AuthError } from '@/lib/auth'

let employee: SessionUser
let otherEmployee: SessionUser
let agent: SessionUser
let admin: SessionUser

beforeAll(async () => {
  const [emp, other, ag, ad] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: 'employee@mop.gov.in' } }),
    prisma.user.findFirstOrThrow({ where: { role: 'EMPLOYEE', email: { not: 'employee@mop.gov.in' } } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'agent@mop.gov.in' } }),
    prisma.user.findUniqueOrThrow({ where: { email: 'admin@mop.gov.in' } }),
  ])

  const toSession = (u: typeof emp): SessionUser => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as SessionUser['role'],
    department: u.department,
  })

  employee = toSession(emp)
  otherEmployee = toSession(other)
  agent = toSession(ag)
  admin = toSession(ad)
})

describe('createTicket — the automation pipeline', () => {
  it('classifies, routes, assigns and sets SLA targets with no human input', async () => {
    const ticket = await createTicket(
      {
        title: 'VPN not connecting from Korba regional office',
        description:
          'Unable to connect to the office VPN since this morning. Authentication failed error appears every time.',
        channel: 'WEB',
      },
      employee,
    )

    expect(ticket.ticketNumber).toMatch(/^MOP-\d{4}-\d{5}$/)
    expect(ticket.category).toBe('NETWORK')
    expect(ticket.autoClassified).toBe(true)
    expect(ticket.classifierConfidence).toBeGreaterThan(0.35)
    expect(ticket.department).toBe('NETWORK_OPS')
    expect(ticket.firstResponseDueAt).toBeInstanceOf(Date)
    expect(ticket.resolutionDueAt).toBeInstanceOf(Date)
    // Resolution must always be the later deadline.
    expect(ticket.resolutionDueAt!.getTime()).toBeGreaterThan(ticket.firstResponseDueAt!.getTime())
  })

  it('writes a CREATED audit event', async () => {
    const ticket = await createTicket(
      { title: 'Printer jam in Accounts section', description: 'The printer keeps jamming on every print job.', channel: 'WEB' },
      employee,
    )

    const events = await prisma.ticketEvent.findMany({ where: { ticketId: ticket.id } })
    expect(events.some((e) => e.type === 'CREATED')).toBe(true)
  })

  it('respects an explicitly supplied category instead of classifying', async () => {
    const ticket = await createTicket(
      {
        title: 'Something is broken on my machine',
        description: 'It does not work properly and I need assistance from the team.',
        category: 'SECURITY',
        priority: 'CRITICAL',
        channel: 'WEB',
      },
      employee,
    )

    expect(ticket.category).toBe('SECURITY')
    expect(ticket.priority).toBe('CRITICAL')
  })

  it('generates unique ticket numbers under concurrent creation', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createTicket(
          { title: `Concurrent ticket number ${i}`, description: 'Testing concurrent ticket number generation safety.', channel: 'WEB' },
          employee,
        ),
      ),
    )

    const numbers = results.map((t) => t.ticketNumber)
    expect(new Set(numbers).size).toBe(numbers.length)
  })
})

describe('listTickets — role scoping', () => {
  it('limits an employee to their own tickets', async () => {
    const result = await listTickets({ sort: 'newest', page: 1, pageSize: 100 }, employee)
    expect(result.tickets.length).toBeGreaterThan(0)
    for (const t of result.tickets) {
      expect(t.createdById).toBe(employee.id)
    }
  })

  it('lets an agent see tickets raised by others', async () => {
    const result = await listTickets({ sort: 'newest', page: 1, pageSize: 100 }, agent)
    expect(result.tickets.some((t) => t.createdById !== agent.id)).toBe(true)
  })

  it('applies status filters', async () => {
    const result = await listTickets({ status: 'OPEN', sort: 'newest', page: 1, pageSize: 50 }, admin)
    for (const t of result.tickets) expect(t.status).toBe('OPEN')
  })
})

describe('getTicket — access control', () => {
  it('refuses an employee access to another employee\'s ticket', async () => {
    const foreign = await prisma.ticket.findFirstOrThrow({
      where: { createdById: { not: employee.id } },
    })

    await expect(getTicket(foreign.id, employee)).rejects.toBeInstanceOf(AuthError)
  })

  it('allows an agent to read any ticket', async () => {
    const someTicket = await prisma.ticket.findFirstOrThrow()
    const result = await getTicket(someTicket.id, agent)
    expect(result.id).toBe(someTicket.id)
  })
})

describe('internal notes — the confidentiality boundary', () => {
  it('never returns internal notes to the requester', async () => {
    const ticket = await createTicket(
      { title: 'Laptop battery draining very fast', description: 'The laptop battery drains within an hour of unplugging it.', channel: 'WEB' },
      employee,
    )

    await addComment(ticket.id, { body: 'Internal: replacement battery ordered from vendor.', isInternal: true }, agent)
    await addComment(ticket.id, { body: 'We are looking into this for you.', isInternal: false }, agent)

    const asRequester = await getTicket(ticket.id, employee)
    expect(asRequester.comments.every((c) => c.isInternal === false)).toBe(true)

    const asAgent = await getTicket(ticket.id, agent)
    expect(asAgent.comments.some((c) => c.isInternal === true)).toBe(true)
  })

  it('rejects an employee attempting to post an internal note', async () => {
    const ticket = await createTicket(
      { title: 'Monitor flickering intermittently', description: 'The external monitor flickers every few minutes during use.', channel: 'WEB' },
      employee,
    )

    await expect(
      addComment(ticket.id, { body: 'Trying to sneak in an internal note', isInternal: true }, employee),
    ).rejects.toBeInstanceOf(AuthError)
  })
})

describe('updateTicket — lifecycle and audit', () => {
  it('stamps resolvedAt and writes an audit event on resolution', async () => {
    const ticket = await createTicket(
      { title: 'Mouse not working on desktop', description: 'The USB mouse is not responding on my desktop machine.', channel: 'WEB' },
      employee,
    )

    const updated = await updateTicket(ticket.id, { status: 'RESOLVED' }, agent)
    expect(updated.status).toBe('RESOLVED')
    expect(updated.resolvedAt).toBeInstanceOf(Date)

    const events = await prisma.ticketEvent.findMany({ where: { ticketId: ticket.id } })
    expect(events.some((e) => e.type === 'RESOLVED' || e.type === 'STATUS_CHANGED')).toBe(true)
  })

  it('clears resolution timestamps when a ticket is reopened', async () => {
    const ticket = await createTicket(
      { title: 'Keyboard keys sticking on laptop', description: 'Several keys on the laptop keyboard are sticking and repeating.', channel: 'WEB' },
      employee,
    )

    await updateTicket(ticket.id, { status: 'RESOLVED' }, agent)
    const reopened = await updateTicket(ticket.id, { status: 'REOPENED' }, agent)

    expect(reopened.status).toBe('REOPENED')
    expect(reopened.resolvedAt).toBeNull()
  })

  it('refuses an employee attempting to close their own open ticket', async () => {
    // Must be a genuinely open ticket: a no-op status change short-circuits
    // before the permission check, which would make this pass vacuously.
    const ticket = await createTicket(
      { title: 'Headset microphone not working', description: 'The headset microphone is not picked up during calls.', channel: 'WEB' },
      employee,
    )

    await expect(updateTicket(ticket.id, { status: 'CLOSED' }, employee)).rejects.toBeInstanceOf(AuthError)
  })

  it('lets a requester reopen their own resolved ticket', async () => {
    const ticket = await createTicket(
      { title: 'Webcam not detected in meetings', description: 'The laptop webcam is not detected by the conferencing application.', channel: 'WEB' },
      employee,
    )
    await updateTicket(ticket.id, { status: 'RESOLVED' }, agent)

    const reopened = await updateTicket(ticket.id, { status: 'REOPENED' }, employee)
    expect(reopened.status).toBe('REOPENED')
  })

  it('recomputes SLA deadlines when priority changes', async () => {
    const ticket = await createTicket(
      { title: 'Scanner not detected by the system', description: 'The document scanner is not being detected by the workstation.', channel: 'WEB' },
      employee,
    )
    const before = ticket.resolutionDueAt!.getTime()

    const updated = await updateTicket(ticket.id, { priority: 'CRITICAL' }, agent)
    // A CRITICAL policy is far tighter, so the deadline must move earlier.
    expect(updated.resolutionDueAt!.getTime()).toBeLessThan(before)
  })
})

describe('cross-employee isolation', () => {
  it('keeps two employees\' ticket lists disjoint', async () => {
    const a = await listTickets({ sort: 'newest', page: 1, pageSize: 100 }, employee)
    const b = await listTickets({ sort: 'newest', page: 1, pageSize: 100 }, otherEmployee)

    const aIds = new Set(a.tickets.map((t) => t.id))
    expect(b.tickets.some((t) => aIds.has(t.id))).toBe(false)
  })
})
