#!/usr/bin/env node
/**
 * Point prisma/schema.prisma at whichever database DATABASE_URL names.
 *
 * Prisma requires `provider` to be a literal, so it cannot read an env var.
 * Without this, deploying to Postgres would mean hand-editing the schema and
 * remembering to revert it before running locally again — exactly the kind of
 * manual step that breaks a demo the night before it matters.
 *
 * Runs on build and on setup. Rewrites the file only when the provider
 * actually differs, so it is a no-op in the common case.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const schemaPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'prisma',
  'schema.prisma',
)

const url = process.env.DATABASE_URL ?? ''
const wanted =
  url.startsWith('postgres://') || url.startsWith('postgresql://')
    ? 'postgresql'
    : 'sqlite'

const schema = readFileSync(schemaPath, 'utf8')
const match = schema.match(/provider\s*=\s*"(sqlite|postgresql)"/)

if (!match) {
  console.error('  Could not find the datasource provider in schema.prisma')
  process.exit(1)
}

if (match[1] === wanted) {
  process.exit(0)
}

writeFileSync(
  schemaPath,
  schema.replace(
    /(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"(?:sqlite|postgresql)"/,
    `$1"${wanted}"`,
  ),
)
console.log(`  Prisma provider set to ${wanted}.`)
