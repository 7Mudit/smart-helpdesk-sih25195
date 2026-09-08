import { describe, it, expect } from 'vitest'
import {
  matchRule,
  pickAgent,
  routeTicket,
  type Rule,
  type AgentLoad,
  type RoutableTicket,
} from '@/lib/automation/router'

function rule(over: Partial<Rule> = {}): Rule {
  return {
    id: 'r1',
    name: 'rule',
    priority: 100,
    matchCategory: null,
    matchKeywords: '',
    matchPriority: null,
    assignDepartment: 'IT_INFRA',
    assignToUserId: null,
    setPriority: null,
    isActive: true,
    ...over,
  }
}

function agent(over: Partial<AgentLoad> = {}): AgentLoad {
  return {
    id: 'a1',
    department: 'IT_INFRA',
    isActive: true,
    openTicketCount: 0,
    lastAssignedAt: null,
    ...over,
  }
}

function ticket(over: Partial<RoutableTicket> = {}): RoutableTicket {
  return {
    category: 'HARDWARE',
    priority: 'MEDIUM',
    title: 'Laptop will not boot',
    description: 'Black screen on power-up',
    ...over,
  }
}

describe('matchRule — no match cases', () => {
  it('returns null when there are no rules at all', () => {
    expect(matchRule(ticket(), [])).toBeNull()
  })

  it('skips inactive rules even when they would otherwise match', () => {
    const r = rule({ matchCategory: 'HARDWARE', isActive: false })
    expect(matchRule(ticket({ category: 'HARDWARE' }), [r])).toBeNull()
  })

  it('returns null when the category criterion does not match', () => {
    const r = rule({ matchCategory: 'NETWORK' })
    expect(matchRule(ticket({ category: 'HARDWARE' }), [r])).toBeNull()
  })

  it('returns null when the priority criterion does not match', () => {
    const r = rule({ matchPriority: 'CRITICAL' })
    expect(matchRule(ticket({ priority: 'LOW' }), [r])).toBeNull()
  })

  it('returns null when no keyword is present in the text', () => {
    const r = rule({ matchKeywords: 'vpn,firewall' })
    expect(matchRule(ticket({ title: 'Printer jam', description: 'tray 2' }), [r])).toBeNull()
  })
})

describe('matchRule — criteria matching', () => {
  it('matches a rule whose only criterion is the category', () => {
    const r = rule({ id: 'cat', matchCategory: 'HARDWARE' })
    expect(matchRule(ticket({ category: 'HARDWARE' }), [r])?.id).toBe('cat')
  })

  it('matches a rule whose only criterion is the priority', () => {
    const r = rule({ id: 'pri', matchPriority: 'CRITICAL' })
    expect(matchRule(ticket({ priority: 'CRITICAL' }), [r])?.id).toBe('pri')
  })

  it('matches a keyword found in the title', () => {
    const r = rule({ id: 'kw', matchKeywords: 'vpn' })
    const t = ticket({ title: 'VPN down', description: 'nothing here' })
    expect(matchRule(t, [r])?.id).toBe('kw')
  })

  it('matches a keyword found in the description', () => {
    const r = rule({ id: 'kw', matchKeywords: 'vpn' })
    const t = ticket({ title: 'Cannot connect', description: 'the vpn client fails' })
    expect(matchRule(t, [r])?.id).toBe('kw')
  })

  it('matches keywords case-insensitively', () => {
    const r = rule({ id: 'kw', matchKeywords: 'VPN' })
    const t = ticket({ title: 'vpn issue', description: '' })
    expect(matchRule(t, [r])?.id).toBe('kw')
  })

  it('matches on a substring, not just a whole word', () => {
    const r = rule({ id: 'kw', matchKeywords: 'print' })
    const t = ticket({ title: 'Printer offline', description: '' })
    expect(matchRule(t, [r])?.id).toBe('kw')
  })

  it('matches when ANY one of several comma-separated keywords hits', () => {
    const r = rule({ id: 'kw', matchKeywords: 'vpn,wifi,dns' })
    const t = ticket({ title: 'wifi keeps dropping', description: '' })
    expect(matchRule(t, [r])?.id).toBe('kw')
  })

  it('tolerates whitespace around comma-separated keywords', () => {
    const r = rule({ id: 'kw', matchKeywords: ' vpn , wifi ' })
    const t = ticket({ title: 'wifi down', description: '' })
    expect(matchRule(t, [r])?.id).toBe('kw')
  })

  it('treats an empty keyword string as "no keyword criterion"', () => {
    // Only the category is a real criterion here; the empty keywords must not
    // block the match (nor match everything by accident).
    const r = rule({ id: 'cat', matchCategory: 'HARDWARE', matchKeywords: '' })
    expect(matchRule(ticket({ category: 'HARDWARE' }), [r])?.id).toBe('cat')
  })

  it('ignores empty segments inside a keyword list', () => {
    const r = rule({ id: 'kw', matchKeywords: 'vpn,,' })
    expect(matchRule(ticket({ title: 'printer', description: '' }), [r])).toBeNull()
  })

  it('matches a rule with NO criteria at all (a catch-all)', () => {
    const r = rule({ id: 'catchall' })
    expect(matchRule(ticket(), [r])?.id).toBe('catchall')
  })
})

describe('matchRule — combined criteria (ALL must match)', () => {
  it('matches when category AND priority both match', () => {
    const r = rule({ id: 'both', matchCategory: 'NETWORK', matchPriority: 'CRITICAL' })
    const t = ticket({ category: 'NETWORK', priority: 'CRITICAL' })
    expect(matchRule(t, [r])?.id).toBe('both')
  })

  it('does NOT match when the category matches but the priority does not', () => {
    const r = rule({ matchCategory: 'NETWORK', matchPriority: 'CRITICAL' })
    const t = ticket({ category: 'NETWORK', priority: 'LOW' })
    expect(matchRule(t, [r])).toBeNull()
  })

  it('does NOT match when the priority matches but the category does not', () => {
    const r = rule({ matchCategory: 'NETWORK', matchPriority: 'CRITICAL' })
    const t = ticket({ category: 'HARDWARE', priority: 'CRITICAL' })
    expect(matchRule(t, [r])).toBeNull()
  })

  it('requires the keyword to match alongside the category', () => {
    const r = rule({ matchCategory: 'NETWORK', matchKeywords: 'vpn' })
    const t = ticket({ category: 'NETWORK', title: 'switch failure', description: '' })
    expect(matchRule(t, [r])).toBeNull()
  })

  it('matches on all three criteria together', () => {
    const r = rule({
      id: 'triple',
      matchCategory: 'NETWORK',
      matchPriority: 'CRITICAL',
      matchKeywords: 'outage',
    })
    const t = ticket({
      category: 'NETWORK',
      priority: 'CRITICAL',
      title: 'Total outage in Block C',
      description: '',
    })
    expect(matchRule(t, [r])?.id).toBe('triple')
  })
})

describe('matchRule — precedence', () => {
  it('picks the lowest `priority` number when several rules match', () => {
    const rules = [
      rule({ id: 'late', priority: 200, matchCategory: 'HARDWARE' }),
      rule({ id: 'early', priority: 10, matchCategory: 'HARDWARE' }),
    ]
    expect(matchRule(ticket({ category: 'HARDWARE' }), rules)?.id).toBe('early')
  })

  it('sorts regardless of the order the rules arrive in', () => {
    const rules = [
      rule({ id: 'first', priority: 1, matchCategory: 'HARDWARE' }),
      rule({ id: 'second', priority: 2, matchCategory: 'HARDWARE' }),
      rule({ id: 'third', priority: 3, matchCategory: 'HARDWARE' }),
    ].reverse()
    expect(matchRule(ticket({ category: 'HARDWARE' }), rules)?.id).toBe('first')
  })

  it('falls through to a lower-precedence rule when the first does not match', () => {
    const rules = [
      rule({ id: 'specific', priority: 1, matchCategory: 'NETWORK' }),
      rule({ id: 'general', priority: 50, matchCategory: 'HARDWARE' }),
    ]
    expect(matchRule(ticket({ category: 'HARDWARE' }), rules)?.id).toBe('general')
  })

  it('lets an active low-precedence rule win over an inactive high-precedence one', () => {
    const rules = [
      rule({ id: 'disabled', priority: 1, matchCategory: 'HARDWARE', isActive: false }),
      rule({ id: 'enabled', priority: 99, matchCategory: 'HARDWARE' }),
    ]
    expect(matchRule(ticket({ category: 'HARDWARE' }), rules)?.id).toBe('enabled')
  })

  it('does not mutate the caller’s rules array while sorting', () => {
    const rules = [
      rule({ id: 'b', priority: 200, matchCategory: 'HARDWARE' }),
      rule({ id: 'a', priority: 10, matchCategory: 'HARDWARE' }),
    ]
    matchRule(ticket({ category: 'HARDWARE' }), rules)
    expect(rules.map((r) => r.id)).toEqual(['b', 'a'])
  })
})

describe('pickAgent', () => {
  it('returns null when there are no agents', () => {
    expect(pickAgent([], 'IT_INFRA')).toBeNull()
  })

  it('returns null when nobody is in the requested department', () => {
    const agents = [agent({ id: 'a1', department: 'NETWORK_OPS' })]
    expect(pickAgent(agents, 'IT_INFRA')).toBeNull()
  })

  it('returns null when every candidate is inactive', () => {
    const agents = [
      agent({ id: 'a1', isActive: false }),
      agent({ id: 'a2', isActive: false }),
    ]
    expect(pickAgent(agents, 'IT_INFRA')).toBeNull()
  })

  it('ignores agents with a null department', () => {
    const agents = [agent({ id: 'a1', department: null })]
    expect(pickAgent(agents, 'IT_INFRA')).toBeNull()
  })

  it('returns the only eligible agent', () => {
    expect(pickAgent([agent({ id: 'solo' })], 'IT_INFRA')).toBe('solo')
  })

  it('picks the agent with the fewest open tickets', () => {
    const agents = [
      agent({ id: 'busy', openTicketCount: 9 }),
      agent({ id: 'quiet', openTicketCount: 1 }),
      agent({ id: 'mid', openTicketCount: 4 }),
    ]
    expect(pickAgent(agents, 'IT_INFRA')).toBe('quiet')
  })

  it('excludes inactive agents from load balancing even when idle', () => {
    const agents = [
      agent({ id: 'inactive', openTicketCount: 0, isActive: false }),
      agent({ id: 'active', openTicketCount: 7 }),
    ]
    expect(pickAgent(agents, 'IT_INFRA')).toBe('active')
  })

  it('excludes other departments from load balancing', () => {
    const agents = [
      agent({ id: 'other', department: 'SECURITY', openTicketCount: 0 }),
      agent({ id: 'ours', department: 'IT_INFRA', openTicketCount: 5 }),
    ]
    expect(pickAgent(agents, 'IT_INFRA')).toBe('ours')
  })

  it('tie-breaks equal load on the oldest lastAssignedAt', () => {
    const agents = [
      agent({
        id: 'recent',
        openTicketCount: 3,
        lastAssignedAt: new Date(2026, 0, 5, 15),
      }),
      agent({
        id: 'stale',
        openTicketCount: 3,
        lastAssignedAt: new Date(2026, 0, 5, 9),
      }),
    ]
    expect(pickAgent(agents, 'IT_INFRA')).toBe('stale')
  })

  it('gives a never-assigned agent (null lastAssignedAt) priority in a tie', () => {
    const agents = [
      agent({
        id: 'veteran',
        openTicketCount: 2,
        lastAssignedAt: new Date(2020, 0, 1),
      }),
      agent({ id: 'newcomer', openTicketCount: 2, lastAssignedAt: null }),
    ]
    expect(pickAgent(agents, 'IT_INFRA')).toBe('newcomer')
  })

  it('still prefers lower load over a never-assigned agent', () => {
    const agents = [
      agent({ id: 'newcomer', openTicketCount: 5, lastAssignedAt: null }),
      agent({ id: 'lighter', openTicketCount: 1, lastAssignedAt: new Date(2026, 0, 5) }),
    ]
    expect(pickAgent(agents, 'IT_INFRA')).toBe('lighter')
  })

  it('is deterministic across repeated calls with the same input', () => {
    const agents = [
      agent({ id: 'a', openTicketCount: 2, lastAssignedAt: new Date(2026, 0, 2) }),
      agent({ id: 'b', openTicketCount: 2, lastAssignedAt: new Date(2026, 0, 1) }),
      agent({ id: 'c', openTicketCount: 2, lastAssignedAt: new Date(2026, 0, 3) }),
    ]
    expect(pickAgent(agents, 'IT_INFRA')).toBe('b')
    expect(pickAgent(agents, 'IT_INFRA')).toBe('b')
  })

  it('keeps input order when two agents tie on load AND are both never-assigned', () => {
    // A total tie must still resolve deterministically rather than arbitrarily.
    const agents = [
      agent({ id: 'first', openTicketCount: 3, lastAssignedAt: null }),
      agent({ id: 'second', openTicketCount: 3, lastAssignedAt: null }),
    ]
    expect(pickAgent(agents, 'IT_INFRA')).toBe('first')
    expect(pickAgent([...agents].reverse(), 'IT_INFRA')).toBe('second')
  })

  it('does not mutate the caller’s agents array', () => {
    const agents = [
      agent({ id: 'a', openTicketCount: 5 }),
      agent({ id: 'b', openTicketCount: 1 }),
    ]
    pickAgent(agents, 'IT_INFRA')
    expect(agents.map((a) => a.id)).toEqual(['a', 'b'])
  })
})

describe('routeTicket — no matching rule', () => {
  it('falls back to GENERAL and load-balances there', () => {
    const agents = [
      agent({ id: 'gen', department: 'GENERAL', openTicketCount: 2 }),
      agent({ id: 'infra', department: 'IT_INFRA', openTicketCount: 0 }),
    ]
    const r = routeTicket(ticket(), [], agents)
    expect(r.department).toBe('GENERAL')
    expect(r.assignedToId).toBe('gen')
    expect(r.matchedRuleId).toBeNull()
    expect(r.priority).toBeNull()
    expect(r.autoRouted).toBe(true)
  })

  it('leaves the ticket unassigned when GENERAL has nobody', () => {
    const r = routeTicket(ticket(), [], [])
    expect(r.department).toBe('GENERAL')
    expect(r.assignedToId).toBeNull()
    expect(r.autoRouted).toBe(false)
  })

  it('reports autoRouted false when every GENERAL agent is inactive', () => {
    const agents = [agent({ id: 'g', department: 'GENERAL', isActive: false })]
    const r = routeTicket(ticket(), [], agents)
    expect(r.assignedToId).toBeNull()
    expect(r.autoRouted).toBe(false)
  })
})

describe('routeTicket — with a matching rule', () => {
  it('uses the rule’s department and its explicitly named agent', () => {
    const rules = [
      rule({
        id: 'net',
        matchCategory: 'NETWORK',
        assignDepartment: 'NETWORK_OPS',
        assignToUserId: 'named-agent',
      }),
    ]
    const r = routeTicket(ticket({ category: 'NETWORK' }), rules, [])
    expect(r.department).toBe('NETWORK_OPS')
    expect(r.assignedToId).toBe('named-agent')
    expect(r.matchedRuleId).toBe('net')
    expect(r.autoRouted).toBe(true)
  })

  it('load-balances inside the rule’s department when no agent is named', () => {
    const rules = [
      rule({ id: 'sec', matchCategory: 'SECURITY', assignDepartment: 'SECURITY' }),
    ]
    const agents = [
      agent({ id: 's1', department: 'SECURITY', openTicketCount: 8 }),
      agent({ id: 's2', department: 'SECURITY', openTicketCount: 1 }),
      agent({ id: 'i1', department: 'IT_INFRA', openTicketCount: 0 }),
    ]
    const r = routeTicket(ticket({ category: 'SECURITY' }), rules, agents)
    expect(r.department).toBe('SECURITY')
    expect(r.assignedToId).toBe('s2')
    expect(r.autoRouted).toBe(true)
  })

  it('keeps the rule’s department but reports autoRouted false with no agents', () => {
    const rules = [
      rule({ id: 'apps', matchCategory: 'SOFTWARE', assignDepartment: 'APPLICATIONS' }),
    ]
    const r = routeTicket(ticket({ category: 'SOFTWARE' }), rules, [])
    expect(r.department).toBe('APPLICATIONS')
    expect(r.assignedToId).toBeNull()
    expect(r.matchedRuleId).toBe('apps')
    expect(r.autoRouted).toBe(false)
  })

  it('honours a named agent even when they are not in the agent list', () => {
    // The rule is an explicit admin instruction; it overrides load balancing.
    const rules = [rule({ id: 'x', assignToUserId: 'hand-picked' })]
    const r = routeTicket(ticket(), rules, [agent({ id: 'other' })])
    expect(r.assignedToId).toBe('hand-picked')
  })
})

describe('routeTicket — priority override', () => {
  it('returns a non-null priority only when the rule sets one', () => {
    const rules = [
      rule({ id: 'esc', matchKeywords: 'outage', setPriority: 'CRITICAL' }),
    ]
    const t = ticket({ title: 'Site-wide outage', priority: 'MEDIUM' })
    expect(routeTicket(t, rules, []).priority).toBe('CRITICAL')
  })

  it('returns a null priority when the matched rule sets none', () => {
    const rules = [rule({ id: 'plain', matchCategory: 'HARDWARE' })]
    expect(routeTicket(ticket({ category: 'HARDWARE' }), rules, []).priority).toBeNull()
  })

  it('returns a null priority when no rule matched at all', () => {
    expect(routeTicket(ticket(), [], []).priority).toBeNull()
  })

  it('applies the override from the first matching rule only', () => {
    const rules = [
      rule({ id: 'first', priority: 1, setPriority: 'HIGH' }),
      rule({ id: 'second', priority: 2, setPriority: 'LOW' }),
    ]
    const r = routeTicket(ticket(), rules, [])
    expect(r.priority).toBe('HIGH')
    expect(r.matchedRuleId).toBe('first')
  })
})

describe('routeTicket — end-to-end realism', () => {
  it('routes a critical VPN outage to network ops and escalates it', () => {
    const rules = [
      rule({
        id: 'vpn-critical',
        priority: 5,
        matchKeywords: 'vpn,outage',
        assignDepartment: 'NETWORK_OPS',
        setPriority: 'CRITICAL',
      }),
      rule({
        id: 'hardware-catchall',
        priority: 100,
        matchCategory: 'HARDWARE',
        assignDepartment: 'IT_INFRA',
      }),
    ]
    const agents = [
      agent({
        id: 'n1',
        department: 'NETWORK_OPS',
        openTicketCount: 3,
        lastAssignedAt: new Date(2026, 0, 5, 16),
      }),
      agent({
        id: 'n2',
        department: 'NETWORK_OPS',
        openTicketCount: 3,
        lastAssignedAt: null,
      }),
    ]
    const t = ticket({
      category: 'NETWORK',
      priority: 'MEDIUM',
      title: 'VPN outage for the whole department',
      description: 'Nobody in Block B can connect',
    })

    const r = routeTicket(t, rules, agents)
    expect(r).toEqual({
      department: 'NETWORK_OPS',
      assignedToId: 'n2', // tie on load, never-assigned wins
      priority: 'CRITICAL',
      matchedRuleId: 'vpn-critical',
      autoRouted: true,
    })
  })
})
