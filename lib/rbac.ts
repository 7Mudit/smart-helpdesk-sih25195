import type { Role } from './constants'

// The permission matrix. Every server-side authorisation decision routes
// through `can()`, so the rules live in exactly one place and can be
// exhaustively unit-tested.

export const PERMISSIONS = {
  // tickets
  'ticket:create': ['EMPLOYEE', 'AGENT', 'ADMIN'],
  'ticket:readOwn': ['EMPLOYEE', 'AGENT', 'ADMIN'],
  'ticket:readAll': ['AGENT', 'ADMIN'],
  'ticket:assign': ['AGENT', 'ADMIN'],
  'ticket:changeStatus': ['AGENT', 'ADMIN'],
  'ticket:changePriority': ['AGENT', 'ADMIN'],
  'ticket:changeCategory': ['AGENT', 'ADMIN'],
  'ticket:changeDepartment': ['AGENT', 'ADMIN'],
  'ticket:delete': ['ADMIN'],
  'ticket:rate': ['EMPLOYEE', 'AGENT', 'ADMIN'],
  'ticket:reopen': ['EMPLOYEE', 'AGENT', 'ADMIN'],

  // comments
  'comment:create': ['EMPLOYEE', 'AGENT', 'ADMIN'],
  'comment:createInternal': ['AGENT', 'ADMIN'],
  'comment:readInternal': ['AGENT', 'ADMIN'],

  // dashboard & reporting
  'dashboard:view': ['AGENT', 'ADMIN'],
  'dashboard:viewAll': ['ADMIN'],

  // knowledge base
  'kb:read': ['EMPLOYEE', 'AGENT', 'ADMIN'],
  'kb:write': ['ADMIN'],

  // administration
  'user:read': ['ADMIN'],
  'user:write': ['ADMIN'],
  'sla:read': ['AGENT', 'ADMIN'],
  'sla:write': ['ADMIN'],
  'rule:read': ['AGENT', 'ADMIN'],
  'rule:write': ['ADMIN'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof PERMISSIONS

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false
  return (PERMISSIONS[permission] as readonly Role[]).includes(role)
}

/**
 * Whether `role` may view the ticket, given who created it and who it is
 * assigned to. Employees are strictly limited to their own tickets — this
 * is the check that stops one employee reading another's IT complaints.
 */
export function canViewTicket(
  user: { id: string; role: Role },
  ticket: { createdById: string; assignedToId: string | null },
): boolean {
  if (can(user.role, 'ticket:readAll')) return true
  return ticket.createdById === user.id
}

/**
 * Employees may only rate tickets they raised; staff may rate on a
 * requester's behalf (phone/walk-in tickets logged for someone else).
 */
export function canRateTicket(
  user: { id: string; role: Role },
  ticket: { createdById: string },
): boolean {
  if (user.role === 'ADMIN') return true
  return ticket.createdById === user.id
}
