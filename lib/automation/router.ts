// Auto-routing — deterministic given the same DB state, which is what makes
// it unit-testable and demo-safe.
//
// Two stages: (1) find the first active RoutingRule that matches, in ascending
// `priority` order; (2) assign an agent — either the one the rule names, or
// the least-loaded active agent in the target department.

import type { Category, Department, Priority } from '@/lib/constants'

export interface RoutableTicket {
  category: Category
  priority: Priority
  title: string
  description: string
}

export interface Rule {
  id: string
  name: string
  priority: number
  matchCategory: string | null
  matchKeywords: string
  matchPriority: string | null
  assignDepartment: string
  assignToUserId: string | null
  setPriority: string | null
  isActive: boolean
}

export interface AgentLoad {
  id: string
  department: string | null
  isActive: boolean
  openTicketCount: number
  lastAssignedAt: Date | null
}

export interface RoutingResult {
  department: Department
  assignedToId: string | null
  /** Non-null only when a matched rule overrode the ticket's priority. */
  priority: Priority | null
  matchedRuleId: string | null
  autoRouted: boolean
}

/** Department used when nothing matches — the human triage queue. */
const FALLBACK_DEPARTMENT: Department = 'GENERAL'

/** Split a comma-separated keyword list into non-empty, lowercased terms. */
function parseKeywords(raw: string): string[] {
  return raw
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length > 0)
}

function ruleMatches(ticket: RoutableTicket, rule: Rule): boolean {
  if (rule.matchCategory !== null && rule.matchCategory !== ticket.category) {
    return false
  }
  if (rule.matchPriority !== null && rule.matchPriority !== ticket.priority) {
    return false
  }

  const keywords = parseKeywords(rule.matchKeywords)
  // An empty keyword list is not a criterion at all, so it neither blocks
  // nor forces a match.
  if (keywords.length > 0) {
    const haystack = `${ticket.title} ${ticket.description}`.toLowerCase()
    if (!keywords.some((k) => haystack.includes(k))) return false
  }

  return true
}

/** First active rule that matches, evaluated in ascending `priority`. */
export function matchRule(ticket: RoutableTicket, rules: Rule[]): Rule | null {
  const ordered = rules
    .filter((r) => r.isActive)
    .slice()
    .sort((a, b) => a.priority - b.priority)

  return ordered.find((r) => ruleMatches(ticket, r)) ?? null
}

/**
 * Least-loaded active agent in `department`. Ties break on the oldest
 * `lastAssignedAt`, with never-assigned agents first so a new joiner is not
 * starved of work.
 */
export function pickAgent(agents: AgentLoad[], department: string): string | null {
  const eligible = agents.filter(
    (a) => a.isActive && a.department === department,
  )
  if (eligible.length === 0) return null

  const ranked = eligible.slice().sort((a, b) => {
    if (a.openTicketCount !== b.openTicketCount) {
      return a.openTicketCount - b.openTicketCount
    }
    // null (never assigned) sorts before any real timestamp.
    const at = a.lastAssignedAt?.getTime() ?? -Infinity
    const bt = b.lastAssignedAt?.getTime() ?? -Infinity
    return at - bt
  })

  // Safe: the empty case returned above, so index 0 always exists.
  return ranked[0]!.id
}

export function routeTicket(
  ticket: RoutableTicket,
  rules: Rule[],
  agents: AgentLoad[],
): RoutingResult {
  const matched = matchRule(ticket, rules)

  const department = (matched?.assignDepartment ?? FALLBACK_DEPARTMENT) as Department

  // A rule naming a specific agent is an explicit admin instruction and wins
  // over load balancing; otherwise balance within the target department.
  const assignedToId =
    matched?.assignToUserId ?? pickAgent(agents, department)

  return {
    department,
    assignedToId,
    priority: (matched?.setPriority as Priority | null | undefined) ?? null,
    matchedRuleId: matched?.id ?? null,
    autoRouted: assignedToId !== null,
  }
}
