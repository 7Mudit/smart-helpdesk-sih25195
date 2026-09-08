#!/usr/bin/env node
/**
 * Creates .env on first run with a freshly generated JWT_SECRET.
 *
 * The secret is generated per machine rather than shipped in .env.example,
 * because a committed secret is a public one — anyone reading the repository
 * could sign a token for any account. lib/auth.ts refuses to start with the
 * placeholder, and this script is what makes that safe default painless.
 */
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env')

const generate = () => randomBytes(32).toString('hex')

const PLACEHOLDERS = new Set([
  'change-me-in-production-min-32-characters-long',
  'your-secret-here',
  'secret',
  'changeme',
])

if (!existsSync(envPath)) {
  writeFileSync(
    envPath,
    `# Local development environment. Not committed — see .gitignore.\n` +
      `DATABASE_URL="file:./dev.db"\n` +
      `JWT_SECRET="${generate()}"\n`,
  )
  console.log('  Created .env with a freshly generated JWT_SECRET.')
} else {
  // An existing .env may still carry the placeholder from an older checkout,
  // or be missing the key entirely. Repair both cases in place.
  const current = readFileSync(envPath, 'utf8')
  const match = current.match(/^JWT_SECRET\s*=\s*"?([^"\n]*)"?/m)
  const value = match?.[1]?.trim() ?? ''

  if (!match) {
    writeFileSync(envPath, `${current.replace(/\n*$/, '\n')}JWT_SECRET="${generate()}"\n`)
    console.log('  Added a generated JWT_SECRET to your existing .env.')
  } else if (PLACEHOLDERS.has(value.toLowerCase()) || value.length < 32) {
    writeFileSync(
      envPath,
      current.replace(/^JWT_SECRET\s*=.*$/m, `JWT_SECRET="${generate()}"`),
    )
    console.log('  Replaced a weak or placeholder JWT_SECRET with a generated one.')
  }
}
