import { describe, it, expect } from 'vitest'
import {
  addBusinessMinutes,
  businessMinutesBetween,
  computeSlaTargets,
  slaStatus,
  slaProgress,
  recomputeSlaTargets,
} from '@/lib/automation/sla'

// All dates are constructed with the local-timezone `new Date(y, m, d, h, mi)`
// form so the tests hold in whatever timezone the server runs in — the spec
// forbids hardcoding an offset.
//
// Calendar anchor used throughout (2026):
//   Mon 2026-01-05 ... Fri 2026-01-09, Sat 2026-01-10, Sun 2026-01-11,
//   Mon 2026-01-12 ... Fri 2026-01-16, Sat 2026-01-17, Sun 2026-01-18, Mon 2026-01-19
const MON = (h: number, mi = 0) => new Date(2026, 0, 5, h, mi, 0, 0)
const TUE = (h: number, mi = 0) => new Date(2026, 0, 6, h, mi, 0, 0)
const WED = (h: number, mi = 0) => new Date(2026, 0, 7, h, mi, 0, 0)
const THU = (h: number, mi = 0) => new Date(2026, 0, 8, h, mi, 0, 0)
const FRI = (h: number, mi = 0) => new Date(2026, 0, 9, h, mi, 0, 0)
const SAT = (h: number, mi = 0) => new Date(2026, 0, 10, h, mi, 0, 0)
const SUN = (h: number, mi = 0) => new Date(2026, 0, 11, h, mi, 0, 0)
const NEXT_MON = (h: number, mi = 0) => new Date(2026, 0, 12, h, mi, 0, 0)
const NEXT_TUE = (h: number, mi = 0) => new Date(2026, 0, 13, h, mi, 0, 0)
const NEXT_WED = (h: number, mi = 0) => new Date(2026, 0, 14, h, mi, 0, 0)

// Sanity: the anchor really is the weekday we claim.
describe('calendar anchor', () => {
  it('2026-01-05 is a Monday and 2026-01-10 is a Saturday', () => {
    expect(MON(9).getDay()).toBe(1)
    expect(FRI(9).getDay()).toBe(5)
    expect(SAT(9).getDay()).toBe(6)
    expect(SUN(9).getDay()).toBe(0)
  })
})

describe('addBusinessMinutes — within a single working day', () => {
  it('adds minutes mid-day without crossing a boundary', () => {
    expect(addBusinessMinutes(MON(10), 60)).toEqual(MON(11))
  })

  it('adds zero minutes and returns the same instant when inside hours', () => {
    expect(addBusinessMinutes(WED(14, 30), 0)).toEqual(WED(14, 30))
  })

  it('handles a fractional-hour span', () => {
    expect(addBusinessMinutes(TUE(9, 45), 30)).toEqual(TUE(10, 15))
  })

  it('lands exactly on 18:00 when the minutes fill the rest of the day', () => {
    // 09:00 + 540 working minutes = 18:00 the same day
    expect(addBusinessMinutes(MON(9), 540)).toEqual(MON(18))
  })

  it('lands exactly on 18:00 from a mid-day start', () => {
    expect(addBusinessMinutes(THU(16), 120)).toEqual(THU(18))
  })
})

describe('addBusinessMinutes — start-time normalisation', () => {
  it('starts the clock at 09:00 when `from` is before 09:00 on a working day', () => {
    // 07:30 Monday is treated as 09:00 Monday
    expect(addBusinessMinutes(MON(7, 30), 60)).toEqual(MON(10))
  })

  it('treats midnight on a working day as 09:00 that day', () => {
    expect(addBusinessMinutes(MON(0), 30)).toEqual(MON(9, 30))
  })

  it('treats exactly 09:00 as already inside hours (no shift)', () => {
    expect(addBusinessMinutes(TUE(9), 60)).toEqual(TUE(10))
  })

  it('rolls to the next working day when `from` is after 18:00', () => {
    expect(addBusinessMinutes(MON(19), 60)).toEqual(TUE(10))
  })

  it('treats exactly 18:00 as end-of-day and rolls to the next working day', () => {
    expect(addBusinessMinutes(MON(18), 60)).toEqual(TUE(10))
  })

  it('rolls a late-Friday start to Monday morning', () => {
    expect(addBusinessMinutes(FRI(20), 30)).toEqual(NEXT_MON(9, 30))
  })

  it('starts Saturday work on Monday at 09:00', () => {
    expect(addBusinessMinutes(SAT(11), 60)).toEqual(NEXT_MON(10))
  })

  it('starts Sunday work on Monday at 09:00', () => {
    expect(addBusinessMinutes(SUN(11), 60)).toEqual(NEXT_MON(10))
  })

  it('starts an early-Saturday instant on Monday at 09:00', () => {
    expect(addBusinessMinutes(SAT(3), 0)).toEqual(NEXT_MON(9))
  })

  it('normalises a before-hours start even with zero minutes', () => {
    expect(addBusinessMinutes(WED(6), 0)).toEqual(WED(9))
  })
})

describe('addBusinessMinutes — spilling across days', () => {
  it('spills past 18:00 onto the next working day', () => {
    // Mon 17:00 + 120 = 60 min to 18:00, 60 min remain → Tue 10:00
    expect(addBusinessMinutes(MON(17), 120)).toEqual(TUE(10))
  })

  it('Friday 17:00 + 120 working minutes → Monday 10:00', () => {
    expect(addBusinessMinutes(FRI(17), 120)).toEqual(NEXT_MON(10))
  })

  it('skips the weekend on a Thursday span that overflows two days', () => {
    // Thu 17:00 + 600 → 60 to Thu 18:00, 540 fills all of Fri → Fri 18:00
    expect(addBusinessMinutes(THU(17), 600)).toEqual(FRI(18))
  })

  it('carries a remainder over the weekend into Monday', () => {
    // Thu 17:00 + 660 → 60 (Thu) + 540 (Fri) + 60 → Mon 10:00
    expect(addBusinessMinutes(THU(17), 660)).toEqual(NEXT_MON(10))
  })

  it('adds exactly one full working day (540) from 09:00 Friday → 18:00 Friday', () => {
    expect(addBusinessMinutes(FRI(9), 540)).toEqual(FRI(18))
  })

  it('adds 541 minutes from Friday 09:00 → Monday 09:01', () => {
    expect(addBusinessMinutes(FRI(9), 541)).toEqual(NEXT_MON(9, 1))
  })

  it('spans a full working week (5 x 540 = 2700) from Monday 09:00', () => {
    expect(addBusinessMinutes(MON(9), 2700)).toEqual(FRI(18))
  })

  it('spans more than a week and skips both weekends', () => {
    // Mon 09:00 + 2700 fills the week to Fri 18:00; +60 more → next Mon 10:00
    expect(addBusinessMinutes(MON(9), 2760)).toEqual(NEXT_MON(10))
  })

  it('spans two full working weeks', () => {
    // 10 working days x 540 = 5400 → Mon 09:00 + 5400 = Fri (week 2) 18:00
    expect(addBusinessMinutes(MON(9), 5400)).toEqual(new Date(2026, 0, 16, 18, 0, 0, 0))
  })

  it('handles a multi-day span starting mid-afternoon', () => {
    // Tue 15:00 + 900: 180 → Tue 18:00; 540 → Wed 18:00; 180 → Thu 12:00
    expect(addBusinessMinutes(TUE(15), 900)).toEqual(THU(12))
  })

  it('handles a 72-hour (LOW resolution, 4320 min) target from Monday 09:00', () => {
    // 4320 / 540 = 8 working days exactly → Wed of the following week at 18:00
    expect(addBusinessMinutes(MON(9), 4320)).toEqual(NEXT_WED(18))
  })

  it('does not mutate the input date', () => {
    const from = MON(10)
    const snapshot = from.getTime()
    addBusinessMinutes(from, 5000)
    expect(from.getTime()).toBe(snapshot)
  })
})

describe('businessMinutesBetween', () => {
  it('counts a simple mid-day span', () => {
    expect(businessMinutesBetween(MON(10), MON(12))).toBe(120)
  })

  it('returns 0 for an inverted range', () => {
    expect(businessMinutesBetween(MON(12), MON(10))).toBe(0)
  })

  it('returns 0 for an identical start and end', () => {
    expect(businessMinutesBetween(MON(12), MON(12))).toBe(0)
  })

  it('counts a full working day as 540', () => {
    expect(businessMinutesBetween(MON(9), MON(18))).toBe(540)
  })

  it('ignores after-hours time between two working days', () => {
    // Mon 17:00 → Tue 10:00 = 60 (Mon) + 60 (Tue)
    expect(businessMinutesBetween(MON(17), TUE(10))).toBe(120)
  })

  it('counts zero working minutes across a weekend', () => {
    expect(businessMinutesBetween(SAT(9), SUN(18))).toBe(0)
  })

  it('skips the weekend when spanning Friday to Monday', () => {
    // Fri 17:00 → Mon 10:00 = 60 + 60
    expect(businessMinutesBetween(FRI(17), NEXT_MON(10))).toBe(120)
  })

  it('clamps a before-hours start and an after-hours end', () => {
    // Mon 06:00 → Mon 22:00 clamps to 09:00–18:00 = 540
    expect(businessMinutesBetween(MON(6), MON(22))).toBe(540)
  })

  it('counts a whole working week as 2700', () => {
    expect(businessMinutesBetween(MON(9), FRI(18))).toBe(2700)
  })

  it('is the inverse of addBusinessMinutes for a multi-day span', () => {
    const due = addBusinessMinutes(TUE(11, 20), 1234)
    expect(businessMinutesBetween(TUE(11, 20), due)).toBe(1234)
  })
})

const POLICY_BH = { firstResponseMins: 60, resolutionMins: 480, businessHoursOnly: true }
const POLICY_24 = { firstResponseMins: 60, resolutionMins: 480, businessHoursOnly: false }

describe('computeSlaTargets', () => {
  it('uses business-hours math when businessHoursOnly is true', () => {
    const t = computeSlaTargets(MON(17), POLICY_BH)
    // 60 min from Mon 17:00 exactly fills the day → the 18:00 boundary itself
    expect(t.firstResponseDueAt).toEqual(MON(18))
    // 480 min: 60 (Mon 17:00→18:00) + 420 (Tue 09:00→16:00)
    expect(t.resolutionDueAt).toEqual(TUE(16))
  })

  it('uses plain wall-clock addition when businessHoursOnly is false', () => {
    const t = computeSlaTargets(FRI(17), POLICY_24)
    expect(t.firstResponseDueAt).toEqual(FRI(18))
    expect(t.resolutionDueAt).toEqual(SAT(1))
  })

  it('wall-clock mode ignores weekends entirely', () => {
    const t = computeSlaTargets(SAT(10), POLICY_24)
    expect(t.firstResponseDueAt).toEqual(SAT(11))
  })

  it('business-hours mode moves a weekend ticket to Monday', () => {
    const t = computeSlaTargets(SAT(10), POLICY_BH)
    expect(t.firstResponseDueAt).toEqual(NEXT_MON(10))
  })

  it('computes CRITICAL targets (15 min / 4 h) in business hours', () => {
    const t = computeSlaTargets(MON(9), {
      firstResponseMins: 15,
      resolutionMins: 240,
      businessHoursOnly: true,
    })
    expect(t.firstResponseDueAt).toEqual(MON(9, 15))
    expect(t.resolutionDueAt).toEqual(MON(13))
  })

  it('computes LOW targets (8 h / 72 h) rolling across days', () => {
    const t = computeSlaTargets(MON(9), {
      firstResponseMins: 480,
      resolutionMins: 4320,
      businessHoursOnly: true,
    })
    expect(t.firstResponseDueAt).toEqual(MON(17))
    expect(t.resolutionDueAt).toEqual(NEXT_WED(18))
  })
})

describe('slaStatus', () => {
  it('returns MET when completed before the deadline', () => {
    expect(slaStatus(MON(12), MON(11), MON(17))).toBe('MET')
  })

  it('returns MET when completed exactly on the deadline', () => {
    expect(slaStatus(MON(12), MON(12), MON(17))).toBe('MET')
  })

  it('returns BREACHED when completed after the deadline', () => {
    expect(slaStatus(MON(12), MON(13), MON(17))).toBe('BREACHED')
  })

  it('returns ON_TRACK when there is no deadline and no completion', () => {
    expect(slaStatus(null, null, MON(12))).toBe('ON_TRACK')
  })

  it('returns MET when there is no deadline but work completed', () => {
    expect(slaStatus(null, MON(11), MON(12))).toBe('MET')
  })

  it('returns BREACHED when now is past an unmet deadline', () => {
    expect(slaStatus(MON(12), null, MON(13))).toBe('BREACHED')
  })

  it('returns ON_TRACK when before the deadline and no window start is known', () => {
    // With no `startedAt` the 80% rule cannot be evaluated, so an unbreached
    // deadline is simply ON_TRACK.
    expect(slaStatus(MON(17), null, MON(9))).toBe('ON_TRACK')
  })

  it('defaults `now` to the current time when omitted', () => {
    const past = new Date(Date.now() - 60_000)
    const future = new Date(Date.now() + 60_000)
    expect(slaStatus(past, null)).toBe('BREACHED')
    expect(slaStatus(future, null)).toBe('ON_TRACK')
  })
})

describe('slaProgress', () => {
  it('is 0 at the start of the window', () => {
    expect(slaProgress(MON(9), MON(19), MON(9))).toBe(0)
  })

  it('is 50 at the midpoint', () => {
    expect(slaProgress(MON(9), MON(19), MON(14))).toBe(50)
  })

  it('is 100 exactly at the deadline', () => {
    expect(slaProgress(MON(9), MON(19), MON(19))).toBe(100)
  })

  it('exceeds 100 once breached', () => {
    expect(slaProgress(MON(9), MON(19), new Date(2026, 0, 6, 0, 0, 0, 0))).toBeGreaterThan(100)
  })

  it('returns 0 when there is no deadline', () => {
    expect(slaProgress(MON(9), null, MON(14))).toBe(0)
  })

  it('never returns a negative value when now precedes the start', () => {
    expect(slaProgress(MON(12), MON(19), MON(9))).toBe(0)
  })

  it('returns 100 for a zero-length window', () => {
    expect(slaProgress(MON(9), MON(9), MON(9))).toBe(100)
  })

  it('defaults `now` to the current time when omitted', () => {
    const start = new Date(Date.now() - 50_000)
    const due = new Date(Date.now() + 50_000)
    const pct = slaProgress(start, due)
    expect(pct).toBeGreaterThan(30)
    expect(pct).toBeLessThan(70)
  })
})

describe('recomputeSlaTargets — hold-time credit', () => {
  it('matches computeSlaTargets when no hold time has accrued', () => {
    const plain = computeSlaTargets(MON(9), POLICY_BH)
    const recomputed = recomputeSlaTargets(MON(9), POLICY_BH, 0)
    expect(recomputed.firstResponseDueAt).toEqual(plain.firstResponseDueAt)
    expect(recomputed.resolutionDueAt).toEqual(plain.resolutionDueAt)
  })

  it('pushes both deadlines out by the hold minutes (business hours)', () => {
    const r = recomputeSlaTargets(MON(9), POLICY_BH, 60)
    expect(r.firstResponseDueAt).toEqual(MON(11)) // 09:00 + 60 + 60
    // 09:00 + 480 + 60 = 540 working minutes = exactly one full day → Mon 18:00
    expect(r.resolutionDueAt).toEqual(MON(18))
  })

  it('credits hold time across a day boundary', () => {
    // Mon 09:00 + 480 + 240 hold = 720 working min → Tue 12:00
    const r = recomputeSlaTargets(MON(9), POLICY_BH, 240)
    expect(r.resolutionDueAt).toEqual(TUE(12))
  })

  it('credits hold time in wall-clock mode too', () => {
    const r = recomputeSlaTargets(FRI(17), POLICY_24, 120)
    expect(r.firstResponseDueAt).toEqual(FRI(20))
    expect(r.resolutionDueAt).toEqual(SAT(3))
  })

  it('recomputes from the original createdAt after a priority change', () => {
    // Ticket created Mon 10:00 as MEDIUM, bumped to CRITICAL: new policy,
    // deadlines still measured from createdAt, plus 30 min of hold.
    const r = recomputeSlaTargets(
      MON(10),
      { firstResponseMins: 15, resolutionMins: 240, businessHoursOnly: true },
      30,
    )
    expect(r.firstResponseDueAt).toEqual(MON(10, 45))
    expect(r.resolutionDueAt).toEqual(MON(14, 30))
  })

  it('credits a large hold that rolls the deadline over a weekend', () => {
    // Fri 09:00 + 480 = Fri 17:00; + 240 hold → Mon 12:00
    const r = recomputeSlaTargets(FRI(9), POLICY_BH, 240)
    expect(r.resolutionDueAt).toEqual(NEXT_MON(12))
  })

  it('does not mutate the createdAt it is given', () => {
    const created = MON(10)
    const snapshot = created.getTime()
    recomputeSlaTargets(created, POLICY_BH, 500)
    expect(created.getTime()).toBe(snapshot)
  })
})

describe('slaStatus — AT_RISK threshold (>= 80% consumed)', () => {
  // Window: created Mon 09:00, due Mon 19:00 (600 wall-clock minutes).
  // slaStatus only sees dueAt + now, so the window it reasons about is
  // implied; these cases pin the 80% rule via slaProgress-aligned inputs.
  it('is AT_RISK at exactly 80% of the window', () => {
    // due Mon 19:00, now Mon 17:00 → 2h of a 10h window remain = 80% consumed
    expect(slaStatus(MON(19), null, MON(17), MON(9))).toBe('AT_RISK')
  })

  it('is ON_TRACK just below 80%', () => {
    expect(slaStatus(MON(19), null, MON(16, 59), MON(9))).toBe('ON_TRACK')
  })

  it('is AT_RISK past 80% but before the deadline', () => {
    expect(slaStatus(MON(19), null, MON(18, 30), MON(9))).toBe('AT_RISK')
  })
})
