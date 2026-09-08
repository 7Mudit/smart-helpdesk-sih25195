// SLA engine — pure date math, no DB access.
//
// Business-hours arithmetic (Mon–Fri, 09:00–18:00 as configured in
// BUSINESS_HOURS) is the highest-value logic in the automation layer: every
// deadline the ministry is held to comes out of these four functions, so they
// are written to be exhaustively testable and free of any hidden timezone
// assumption. All arithmetic is done in the server's LOCAL timezone via the
// Date component accessors — no offset is ever hardcoded.

import { BUSINESS_HOURS } from '@/lib/constants'

export interface SlaTarget {
  firstResponseDueAt: Date
  resolutionDueAt: Date
}

export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'MET'

/** Fraction of the SLA window that must be consumed before we warn. */
const AT_RISK_THRESHOLD = 0.8

const MS_PER_MINUTE = 60_000

/** Working minutes available in a single working day. */
const MINUTES_PER_WORKING_DAY =
  (BUSINESS_HOURS.endHour - BUSINESS_HOURS.startHour) * 60

function isWorkingDay(d: Date): boolean {
  return (BUSINESS_HOURS.workingDays as readonly number[]).includes(d.getDay())
}

/** Local-midnight-anchored 09:00 on the same calendar day as `d`. */
function startOfWorkday(d: Date): Date {
  const out = new Date(d)
  out.setHours(BUSINESS_HOURS.startHour, 0, 0, 0)
  return out
}

/** Local-midnight-anchored 18:00 on the same calendar day as `d`. */
function endOfWorkday(d: Date): Date {
  const out = new Date(d)
  out.setHours(BUSINESS_HOURS.endHour, 0, 0, 0)
  return out
}

/** 09:00 on the next working day strictly after `d`. */
function nextWorkdayStart(d: Date): Date {
  const out = new Date(d)
  do {
    out.setDate(out.getDate() + 1)
  } while (!isWorkingDay(out))
  return startOfWorkday(out)
}

/**
 * Move `from` to the first instant at which the business clock is running:
 * unchanged if already inside working hours, 09:00 the same day if before
 * hours on a working day, otherwise 09:00 on the next working day. An instant
 * exactly at 18:00 counts as the end of that day and rolls forward.
 */
function normaliseToWorkingTime(from: Date): Date {
  let cursor = new Date(from)

  for (;;) {
    if (!isWorkingDay(cursor)) {
      cursor = nextWorkdayStart(cursor)
      continue
    }
    const dayStart = startOfWorkday(cursor)
    const dayEnd = endOfWorkday(cursor)

    if (cursor.getTime() < dayStart.getTime()) return dayStart
    if (cursor.getTime() >= dayEnd.getTime()) {
      cursor = nextWorkdayStart(cursor)
      continue
    }
    return cursor
  }
}

/** Add `minutes` of WORKING time to `from`, skipping nights and weekends. */
export function addBusinessMinutes(from: Date, minutes: number): Date {
  let cursor = normaliseToWorkingTime(from)
  let remaining = minutes

  if (remaining <= 0) return cursor

  for (;;) {
    const dayEnd = endOfWorkday(cursor)
    const availableToday = Math.round(
      (dayEnd.getTime() - cursor.getTime()) / MS_PER_MINUTE,
    )

    // Consuming exactly the rest of the day lands on 18:00, which is a legal
    // deadline — we only roll forward when minutes genuinely remain.
    if (remaining <= availableToday) {
      return new Date(cursor.getTime() + remaining * MS_PER_MINUTE)
    }

    remaining -= availableToday
    cursor = nextWorkdayStart(cursor)
  }
}

/** Working minutes elapsed between two instants. Inverted ranges yield 0. */
export function businessMinutesBetween(start: Date, end: Date): number {
  if (end.getTime() <= start.getTime()) return 0

  let total = 0
  let cursor = new Date(start)

  while (cursor.getTime() < end.getTime()) {
    if (!isWorkingDay(cursor)) {
      cursor = nextWorkdayStart(cursor)
      continue
    }

    const dayStart = startOfWorkday(cursor)
    const dayEnd = endOfWorkday(cursor)

    // Clamp this day's countable window to [max(cursor, 09:00), min(end, 18:00)].
    const windowStart =
      cursor.getTime() < dayStart.getTime() ? dayStart : cursor
    const windowEnd = end.getTime() < dayEnd.getTime() ? end : dayEnd

    if (windowEnd.getTime() > windowStart.getTime()) {
      total += Math.round(
        (windowEnd.getTime() - windowStart.getTime()) / MS_PER_MINUTE,
      )
    }

    cursor = nextWorkdayStart(cursor)
  }

  return total
}

/** Plain wall-clock addition, used when a policy is not business-hours-only. */
function addWallClockMinutes(from: Date, minutes: number): Date {
  return new Date(from.getTime() + minutes * MS_PER_MINUTE)
}

export function computeSlaTargets(
  createdAt: Date,
  policy: {
    firstResponseMins: number
    resolutionMins: number
    businessHoursOnly: boolean
  },
): SlaTarget {
  const add = policy.businessHoursOnly ? addBusinessMinutes : addWallClockMinutes
  return {
    firstResponseDueAt: add(createdAt, policy.firstResponseMins),
    resolutionDueAt: add(createdAt, policy.resolutionMins),
  }
}

/**
 * Current SLA state.
 *
 * `startedAt` is optional: without it the 80% AT_RISK rule has no window to
 * measure against, so an unbreached deadline reports ON_TRACK.
 */
export function slaStatus(
  dueAt: Date | null,
  completedAt: Date | null,
  now: Date = new Date(),
  startedAt?: Date,
): SlaState {
  if (completedAt) {
    if (!dueAt) return 'MET'
    return completedAt.getTime() <= dueAt.getTime() ? 'MET' : 'BREACHED'
  }

  if (!dueAt) return 'ON_TRACK'
  if (now.getTime() > dueAt.getTime()) return 'BREACHED'

  if (startedAt) {
    const window = dueAt.getTime() - startedAt.getTime()
    if (window > 0) {
      const consumed = (now.getTime() - startedAt.getTime()) / window
      if (consumed >= AT_RISK_THRESHOLD) return 'AT_RISK'
    }
  }

  return 'ON_TRACK'
}

/** Percentage of the SLA window consumed, 0..100+ (exceeds 100 when breached). */
export function slaProgress(
  startedAt: Date,
  dueAt: Date | null,
  now: Date = new Date(),
): number {
  if (!dueAt) return 0

  const window = dueAt.getTime() - startedAt.getTime()
  // A zero- or negative-length window is already fully consumed.
  if (window <= 0) return 100

  const consumed = now.getTime() - startedAt.getTime()
  if (consumed <= 0) return 0

  return (consumed / window) * 100
}

/**
 * Recompute deadlines after a priority change. Both deadlines are measured
 * from the ORIGINAL `createdAt` (so a ticket cannot buy itself more time by
 * being re-prioritised), with the minutes spent ON_HOLD credited back.
 */
export function recomputeSlaTargets(
  createdAt: Date,
  policy: {
    firstResponseMins: number
    resolutionMins: number
    businessHoursOnly: boolean
  },
  holdMinutes: number,
): SlaTarget {
  const credit = Math.max(0, holdMinutes)
  return computeSlaTargets(createdAt, {
    ...policy,
    firstResponseMins: policy.firstResponseMins + credit,
    resolutionMins: policy.resolutionMins + credit,
  })
}
