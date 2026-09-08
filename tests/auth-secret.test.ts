/**
 * Regression tests for the JWT secret guard.
 *
 * A security audit found that .env.example shipped a placeholder secret long
 * enough to pass the old length check. Since that file is committed, anyone
 * reading the repository could sign a token for any account — including an
 * admin one — and the app would accept it. These tests pin the guard that
 * makes the placeholder unusable.
 *
 * They exercise `assertUsableSecret` directly rather than re-importing the
 * module per case: the guard is pure, so testing it in isolation is both
 * simpler and a more honest unit test than juggling module caches.
 */
import { describe, it, expect } from 'vitest'
import { assertUsableSecret } from '@/lib/auth'

const expectRejected = (value: string | undefined, pattern: RegExp) => {
  expect(() => assertUsableSecret(value)).toThrow(pattern)
}

describe('JWT secret guard', () => {
  it('refuses the placeholder committed in .env.example', () => {
    expectRejected('change-me-in-production-min-32-characters-long', /placeholder/i)
  })

  it('refuses common weak placeholders regardless of case or padding', () => {
    for (const weak of ['secret', 'changeme', 'CHANGEME', 'Your-Secret-Here', '  secret  ']) {
      expect(() => assertUsableSecret(weak), `expected "${weak}" to be rejected`).toThrow()
    }
  })

  it('refuses a secret shorter than 32 characters', () => {
    expectRejected('a'.repeat(31), /at least 32/i)
  })

  it('refuses an empty or missing secret with actionable guidance', () => {
    expectRejected(undefined, /randomBytes/)
    expectRejected('', /randomBytes/)
  })

  it('accepts a proper random secret', () => {
    expect(() => assertUsableSecret('f'.repeat(64))).not.toThrow()
    expect(() => assertUsableSecret('a'.repeat(32))).not.toThrow()
  })
})
