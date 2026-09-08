// Human-readable ticket identifiers: MOP-2026-00042.
//
// The sequence restarts each calendar year, which is how government file
// numbering is normally kept. Uniqueness is ultimately guaranteed by the
// UNIQUE constraint on Ticket.ticketNumber — this module only has to be
// deterministic, so two callers reading the same "latest" row derive the same
// candidate and exactly one of them wins the insert.

const PREFIX = 'MOP'
const SEQUENCE_DIGITS = 5

/** MOP-<4-digit year>-<at least 5 digits>, anchored so trailing junk fails. */
const TICKET_NUMBER_RE = /^MOP-(\d{4})-(\d{5,})$/

export function formatTicketNumber(year: number, sequence: number): string {
  return `${PREFIX}-${year}-${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`
}

export function parseTicketNumber(
  t: string,
): { year: number; sequence: number } | null {
  const match = TICKET_NUMBER_RE.exec(t)
  if (!match) return null

  // Safe: both capture groups are mandatory in the pattern, so a successful
  // exec always yields them.
  return { year: Number(match[1]!), sequence: Number(match[2]!) }
}

/**
 * The next number in sequence. Resets to 00001 whenever `latest` is absent,
 * malformed, or belongs to any year other than the current one — a stray
 * future-dated record must not poison this year's numbering.
 */
export function nextTicketNumber(latest: string | null, now: Date = new Date()): string {
  const year = now.getFullYear()
  const parsed = latest ? parseTicketNumber(latest) : null

  if (!parsed || parsed.year !== year) return formatTicketNumber(year, 1)

  return formatTicketNumber(year, parsed.sequence + 1)
}
