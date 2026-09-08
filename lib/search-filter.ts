/**
 * Case-insensitive `contains` filter that works on both datasources.
 *
 * SQLite's LIKE is already ASCII-case-insensitive, and its Prisma client is
 * generated without the `QueryMode` type at all — so passing
 * `mode: 'insensitive'` there is a type error, not just redundant.
 *
 * PostgreSQL's LIKE *is* case-sensitive, so the same query silently stops
 * matching "VPN" against "vpn" the moment the app is deployed. That is exactly
 * the kind of bug that passes every local test and then breaks in production.
 *
 * This helper reads the configured provider and emits whichever shape is
 * correct, so `search` behaves identically in both environments.
 */

/** True when the app is pointed at PostgreSQL rather than the local SQLite file. */
export function isPostgres(): boolean {
  const url = process.env.DATABASE_URL ?? ''
  return url.startsWith('postgres://') || url.startsWith('postgresql://')
}

/**
 * Build a case-insensitive `contains` filter for the active database.
 *
 * The return type is loose on purpose: the generated Prisma types differ
 * between providers, and the object is only ever spread into a `where` clause
 * that Prisma validates at the call site.
 */
export function insensitiveContains(value: string): { contains: string; mode?: 'insensitive' } {
  return isPostgres() ? { contains: value, mode: 'insensitive' } : { contains: value }
}
