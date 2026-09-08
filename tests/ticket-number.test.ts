import { describe, it, expect } from 'vitest'
import {
  formatTicketNumber,
  parseTicketNumber,
  nextTicketNumber,
} from '@/lib/automation/ticket-number'

describe('formatTicketNumber', () => {
  it('formats with a 5-digit zero-padded sequence', () => {
    expect(formatTicketNumber(2026, 42)).toBe('MOP-2026-00042')
  })

  it('formats the very first ticket of a year', () => {
    expect(formatTicketNumber(2026, 1)).toBe('MOP-2026-00001')
  })

  it('pads a two-digit sequence', () => {
    expect(formatTicketNumber(2026, 7)).toBe('MOP-2026-00007')
  })

  it('does not pad a sequence that already fills five digits', () => {
    expect(formatTicketNumber(2026, 99999)).toBe('MOP-2026-99999')
  })

  it('allows a sequence to overflow past five digits without truncating', () => {
    expect(formatTicketNumber(2026, 100000)).toBe('MOP-2026-100000')
  })

  it('uses the year it is given', () => {
    expect(formatTicketNumber(2027, 3)).toBe('MOP-2027-00003')
  })

  it('produces lexicographically sortable numbers within a year', () => {
    const nums = [
      formatTicketNumber(2026, 3),
      formatTicketNumber(2026, 20),
      formatTicketNumber(2026, 100),
    ]
    expect([...nums].sort()).toEqual(nums)
  })
})

describe('parseTicketNumber', () => {
  it('round-trips a formatted number', () => {
    expect(parseTicketNumber('MOP-2026-00042')).toEqual({ year: 2026, sequence: 42 })
  })

  it('strips the zero padding from the sequence', () => {
    expect(parseTicketNumber('MOP-2026-00001')).toEqual({ year: 2026, sequence: 1 })
  })

  it('parses a five-digit sequence', () => {
    expect(parseTicketNumber('MOP-2026-99999')).toEqual({ year: 2026, sequence: 99999 })
  })

  it('returns null for an empty string', () => {
    expect(parseTicketNumber('')).toBeNull()
  })

  it('returns null for a wrong prefix', () => {
    expect(parseTicketNumber('XYZ-2026-00042')).toBeNull()
  })

  it('returns null for a missing sequence segment', () => {
    expect(parseTicketNumber('MOP-2026')).toBeNull()
  })

  it('returns null for a non-numeric sequence', () => {
    expect(parseTicketNumber('MOP-2026-ABCDE')).toBeNull()
  })

  it('returns null for a non-numeric year', () => {
    expect(parseTicketNumber('MOP-YEAR-00042')).toBeNull()
  })

  it('returns null for a short sequence', () => {
    expect(parseTicketNumber('MOP-2026-42')).toBeNull()
  })

  it('returns null for a two-digit year', () => {
    expect(parseTicketNumber('MOP-26-00042')).toBeNull()
  })

  it('returns null for arbitrary garbage', () => {
    expect(parseTicketNumber('not a ticket number')).toBeNull()
  })

  it('returns null for a lowercase prefix', () => {
    expect(parseTicketNumber('mop-2026-00042')).toBeNull()
  })

  it('returns null when there is trailing content', () => {
    expect(parseTicketNumber('MOP-2026-00042-EXTRA')).toBeNull()
  })

  it('is the inverse of formatTicketNumber', () => {
    const formatted = formatTicketNumber(2026, 1234)
    expect(parseTicketNumber(formatted)).toEqual({ year: 2026, sequence: 1234 })
  })
})

describe('nextTicketNumber', () => {
  const IN_2026 = new Date(2026, 5, 15, 12, 0, 0, 0)
  const IN_2027 = new Date(2027, 0, 1, 0, 0, 0, 0)

  it('starts at 00001 when there is no previous ticket', () => {
    expect(nextTicketNumber(null, IN_2026)).toBe('MOP-2026-00001')
  })

  it('increments within the same year', () => {
    expect(nextTicketNumber('MOP-2026-00042', IN_2026)).toBe('MOP-2026-00043')
  })

  it('increments from the first ticket of the year', () => {
    expect(nextTicketNumber('MOP-2026-00001', IN_2026)).toBe('MOP-2026-00002')
  })

  it('carries the padding across a digit boundary', () => {
    expect(nextTicketNumber('MOP-2026-00099', IN_2026)).toBe('MOP-2026-00100')
  })

  it('grows past five digits when a year is very busy', () => {
    expect(nextTicketNumber('MOP-2026-99999', IN_2026)).toBe('MOP-2026-100000')
  })

  it('resets to 00001 on a year rollover', () => {
    expect(nextTicketNumber('MOP-2026-00873', IN_2027)).toBe('MOP-2027-00001')
  })

  it('resets when the latest number is from a much older year', () => {
    expect(nextTicketNumber('MOP-2019-04321', IN_2026)).toBe('MOP-2026-00001')
  })

  it('resets to 00001 when the latest number is malformed', () => {
    expect(nextTicketNumber('garbage', IN_2026)).toBe('MOP-2026-00001')
  })

  it('resets to 00001 when the latest number has a bad prefix', () => {
    expect(nextTicketNumber('ABC-2026-00042', IN_2026)).toBe('MOP-2026-00001')
  })

  it('resets to 00001 for an empty latest string', () => {
    expect(nextTicketNumber('', IN_2026)).toBe('MOP-2026-00001')
  })

  it('ignores a latest number from a FUTURE year and uses the current year', () => {
    // Clock skew must not let a stray future record poison this year's run.
    expect(nextTicketNumber('MOP-2030-00500', IN_2026)).toBe('MOP-2026-00001')
  })

  it('defaults `now` to the current date when omitted', () => {
    const year = new Date().getFullYear()
    expect(nextTicketNumber(null)).toBe(formatTicketNumber(year, 1))
  })

  it('is monotonic when applied repeatedly', () => {
    let current = nextTicketNumber(null, IN_2026)
    const seen = [current]
    for (let i = 0; i < 4; i++) {
      current = nextTicketNumber(current, IN_2026)
      seen.push(current)
    }
    expect(seen).toEqual([
      'MOP-2026-00001',
      'MOP-2026-00002',
      'MOP-2026-00003',
      'MOP-2026-00004',
      'MOP-2026-00005',
    ])
  })

  it('is deterministic — the same latest always yields the same next', () => {
    // Concurrent callers seeing the same "latest" row derive the same value,
    // which is exactly why the DB keeps a UNIQUE constraint on ticketNumber.
    const a = nextTicketNumber('MOP-2026-00042', IN_2026)
    const b = nextTicketNumber('MOP-2026-00042', IN_2026)
    expect(a).toBe(b)
  })
})
