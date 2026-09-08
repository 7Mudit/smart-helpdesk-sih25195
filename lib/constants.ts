// Single source of truth for every enum-like value in the system.
// SQLite has no native enums, so these unions + the Zod schemas in
// lib/validation.ts are what actually enforce correctness.

export const ROLES = ['EMPLOYEE', 'AGENT', 'ADMIN'] as const
export type Role = (typeof ROLES)[number]

export const CATEGORIES = [
  'HARDWARE',
  'SOFTWARE',
  'NETWORK',
  'ACCESS',
  'EMAIL',
  'SAP_ERP',
  'SECURITY',
  'OTHER',
] as const
export type Category = (typeof CATEGORIES)[number]

export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
export type Priority = (typeof PRIORITIES)[number]

export const STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'ON_HOLD',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
] as const
export type Status = (typeof STATUSES)[number]

export const CHANNELS = ['WEB', 'EMAIL', 'PHONE', 'WALK_IN'] as const
export type Channel = (typeof CHANNELS)[number]

export const DEPARTMENTS = [
  'IT_INFRA',
  'APPLICATIONS',
  'NETWORK_OPS',
  'SECURITY',
  'GENERAL',
] as const
export type Department = (typeof DEPARTMENTS)[number]

export const EVENT_TYPES = [
  'CREATED',
  'ASSIGNED',
  'REASSIGNED',
  'STATUS_CHANGED',
  'PRIORITY_CHANGED',
  'CATEGORY_CHANGED',
  'COMMENTED',
  'INTERNAL_NOTE',
  'ESCALATED',
  'SLA_BREACHED',
  'RESOLVED',
  'REOPENED',
  'CLOSED',
  'AUTO_CLASSIFIED',
  'AUTO_ROUTED',
  'ATTACHMENT_ADDED',
  'RATED',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

// --- display helpers -------------------------------------------------

export const PRIORITY_RANK: Record<Priority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
}

/** One step up the priority ladder; CRITICAL is the ceiling. */
export function escalatePriority(p: Priority): Priority {
  const order: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  return order[Math.min(order.indexOf(p) + 1, order.length - 1)]!
}

/** Statuses in which the SLA resolution clock is considered stopped. */
export const TERMINAL_STATUSES: Status[] = ['RESOLVED', 'CLOSED']

export const LABELS = {
  category: {
    HARDWARE: 'Hardware',
    SOFTWARE: 'Software',
    NETWORK: 'Network',
    ACCESS: 'Access / Account',
    EMAIL: 'Email',
    SAP_ERP: 'SAP / ERP',
    SECURITY: 'Security',
    OTHER: 'Other',
  } satisfies Record<Category, string>,
  department: {
    IT_INFRA: 'IT Infrastructure',
    APPLICATIONS: 'Applications',
    NETWORK_OPS: 'Network Operations',
    SECURITY: 'Information Security',
    GENERAL: 'General Support',
  } satisfies Record<Department, string>,
  status: {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    ON_HOLD: 'On Hold',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
    REOPENED: 'Reopened',
  } satisfies Record<Status, string>,
  priority: {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
    CRITICAL: 'Critical',
  } satisfies Record<Priority, string>,
  channel: {
    WEB: 'Web Portal',
    EMAIL: 'Email',
    PHONE: 'Phone',
    WALK_IN: 'Walk-in',
  } satisfies Record<Channel, string>,
} as const

export const BUSINESS_HOURS = {
  startHour: 9, // 09:00 IST
  endHour: 18, // 18:00 IST
  workingDays: [1, 2, 3, 4, 5], // Mon-Fri
} as const

export const CLASSIFIER_CONFIDENCE_FLOOR = 0.35
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.55
