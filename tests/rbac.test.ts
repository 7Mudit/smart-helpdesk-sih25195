import { describe, it, expect } from 'vitest'
import { can, canViewTicket, canRateTicket, PERMISSIONS, type Permission } from '@/lib/rbac'
import { ROLES, type Role } from '@/lib/constants'

// The expected matrix is written out longhand rather than derived from
// PERMISSIONS, so that an accidental edit to the source matrix fails a test
// instead of silently rewriting its own expectation.
const EXPECTED: Record<Permission, Role[]> = {
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
  'comment:create': ['EMPLOYEE', 'AGENT', 'ADMIN'],
  'comment:createInternal': ['AGENT', 'ADMIN'],
  'comment:readInternal': ['AGENT', 'ADMIN'],
  'dashboard:view': ['AGENT', 'ADMIN'],
  'dashboard:viewAll': ['ADMIN'],
  'kb:read': ['EMPLOYEE', 'AGENT', 'ADMIN'],
  'kb:write': ['ADMIN'],
  'user:read': ['ADMIN'],
  'user:write': ['ADMIN'],
  'sla:read': ['AGENT', 'ADMIN'],
  'sla:write': ['ADMIN'],
  'rule:read': ['AGENT', 'ADMIN'],
  'rule:write': ['ADMIN'],
}

const ALL_PERMISSIONS = Object.keys(EXPECTED) as Permission[]

describe('permission matrix integrity', () => {
  it('covers every permission key defined in lib/rbac.ts', () => {
    expect(ALL_PERMISSIONS.sort()).toEqual(Object.keys(PERMISSIONS).sort())
  })

  it('knows about exactly three roles', () => {
    expect([...ROLES]).toEqual(['EMPLOYEE', 'AGENT', 'ADMIN'])
  })

  it('grants no permission to an empty role list', () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(EXPECTED[permission].length).toBeGreaterThan(0)
    }
  })
})

describe('can() — every role x every permission', () => {
  for (const permission of ALL_PERMISSIONS) {
    for (const role of ROLES) {
      const allowed = EXPECTED[permission].includes(role)
      it(`${role} ${allowed ? 'CAN' : 'cannot'} ${permission}`, () => {
        expect(can(role, permission)).toBe(allowed)
      })
    }
  }
})

describe('can() — ADMIN reach', () => {
  it('grants ADMIN every permission in the matrix', () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(can('ADMIN', permission)).toBe(true)
    }
  })

  it('denies EMPLOYEE every admin-only permission', () => {
    const adminOnly = ALL_PERMISSIONS.filter(
      (p) => EXPECTED[p].length === 1 && EXPECTED[p][0] === 'ADMIN',
    )
    expect(adminOnly.length).toBeGreaterThan(0)
    for (const permission of adminOnly) {
      expect(can('EMPLOYEE', permission)).toBe(false)
      expect(can('AGENT', permission)).toBe(false)
    }
  })

  it('denies EMPLOYEE the staff-only ticket operations', () => {
    const staffOnly: Permission[] = [
      'ticket:readAll',
      'ticket:assign',
      'ticket:changeStatus',
      'ticket:changePriority',
      'ticket:changeCategory',
      'ticket:changeDepartment',
      'comment:createInternal',
      'comment:readInternal',
      'dashboard:view',
    ]
    for (const permission of staffOnly) {
      expect(can('EMPLOYEE', permission)).toBe(false)
    }
  })

  it('denies AGENT the four admin-write permissions', () => {
    for (const permission of ['user:write', 'sla:write', 'rule:write', 'kb:write'] as Permission[]) {
      expect(can('AGENT', permission)).toBe(false)
    }
  })
})

describe('can() — absent role', () => {
  it('denies every permission when the role is undefined', () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(can(undefined, permission)).toBe(false)
    }
  })

  it('denies every permission when the role is null', () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(can(null, permission)).toBe(false)
    }
  })
})

describe('canViewTicket', () => {
  const OWN = { createdById: 'u-employee', assignedToId: null }
  const SOMEONE_ELSE = { createdById: 'u-other', assignedToId: null }
  const employee = { id: 'u-employee', role: 'EMPLOYEE' as Role }

  it('lets an employee view a ticket they raised', () => {
    expect(canViewTicket(employee, OWN)).toBe(true)
  })

  it('stops an employee viewing another employee’s ticket', () => {
    expect(canViewTicket(employee, SOMEONE_ELSE)).toBe(false)
  })

  it('stops an employee viewing a ticket merely assigned to them', () => {
    // Employees are never assignees in practice; the own-ticket rule is
    // strictly about who created it.
    expect(
      canViewTicket(employee, { createdById: 'u-other', assignedToId: 'u-employee' }),
    ).toBe(false)
  })

  it('lets an agent view any ticket', () => {
    const agent = { id: 'u-agent', role: 'AGENT' as Role }
    expect(canViewTicket(agent, OWN)).toBe(true)
    expect(canViewTicket(agent, SOMEONE_ELSE)).toBe(true)
  })

  it('lets an admin view any ticket', () => {
    const admin = { id: 'u-admin', role: 'ADMIN' as Role }
    expect(canViewTicket(admin, OWN)).toBe(true)
    expect(canViewTicket(admin, SOMEONE_ELSE)).toBe(true)
  })

  it('lets an agent view their own raised ticket', () => {
    const agent = { id: 'u-agent', role: 'AGENT' as Role }
    expect(canViewTicket(agent, { createdById: 'u-agent', assignedToId: null })).toBe(true)
  })
})

describe('canRateTicket', () => {
  it('lets an employee rate a ticket they raised', () => {
    expect(
      canRateTicket({ id: 'u1', role: 'EMPLOYEE' }, { createdById: 'u1' }),
    ).toBe(true)
  })

  it('stops an employee rating someone else’s ticket', () => {
    expect(
      canRateTicket({ id: 'u1', role: 'EMPLOYEE' }, { createdById: 'u2' }),
    ).toBe(false)
  })

  it('lets an agent rate a ticket they raised', () => {
    expect(canRateTicket({ id: 'a1', role: 'AGENT' }, { createdById: 'a1' })).toBe(true)
  })

  it('stops an agent rating a ticket they did not raise', () => {
    expect(canRateTicket({ id: 'a1', role: 'AGENT' }, { createdById: 'u2' })).toBe(false)
  })

  it('lets an admin rate any ticket on a requester’s behalf', () => {
    expect(canRateTicket({ id: 'ad1', role: 'ADMIN' }, { createdById: 'u2' })).toBe(true)
  })

  it('lets an admin rate their own ticket', () => {
    expect(canRateTicket({ id: 'ad1', role: 'ADMIN' }, { createdById: 'ad1' })).toBe(true)
  })
})
