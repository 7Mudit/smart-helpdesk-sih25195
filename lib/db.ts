import { PrismaClient } from '@prisma/client'

// Next.js dev mode hot-reloads modules, which would otherwise leak a new
// PrismaClient (and connection pool) on every save.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * SQLite allows a single writer at a time. Under a burst of concurrent writes
 * the default 5-second pool timeout expires while requests queue behind that
 * lock, and Prisma surfaces it as an opaque "Socket timeout" 500 — a lost
 * ticket submission with no hint that retrying would work.
 *
 * Raising the pool timeout lets writers wait their turn instead of failing.
 * Postgres, used in deployment, has no single-writer limitation and simply
 * ignores this.
 */
function datasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  if (!url || !url.startsWith('file:')) return url

  const [base, query = ''] = url.split('?')
  const params = new URLSearchParams(query)
  if (!params.has('connection_limit')) params.set('connection_limit', '1')
  if (!params.has('pool_timeout')) params.set('pool_timeout', '30')
  return `${base}?${params.toString()}`
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasourceUrl: datasourceUrl(),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
