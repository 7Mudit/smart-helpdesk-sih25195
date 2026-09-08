import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from './db'
import type { Role } from './constants'

const COOKIE_NAME = 'helpdesk_session'
const SESSION_DAYS = 7

/**
 * The placeholder shipped in .env.example. It is committed to the repository,
 * so anyone can read it — and a JWT signed with a known secret is a forged
 * session for any account, including an admin one. It must never be able to
 * sign a real token, which means rejecting it here rather than trusting
 * everyone to remember to change it.
 */
const PLACEHOLDER_SECRETS = new Set([
  'change-me-in-production-min-32-characters-long',
  'your-secret-here',
  'secret',
  'changeme',
])

const MIN_SECRET_LENGTH = 32

/**
 * Validate a candidate signing secret. Exported so the rule is unit-testable
 * without touching process.env or the module cache.
 */
export function assertUsableSecret(s: string | undefined): asserts s is string {
  if (!s) {
    throw new Error(
      'JWT_SECRET is not set. Run `npm run setup`, or generate one with:\n' +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    )
  }

  if (PLACEHOLDER_SECRETS.has(s.trim().toLowerCase())) {
    throw new Error(
      'JWT_SECRET is still the example placeholder, which is public in this ' +
        'repository — anyone could forge an admin session with it. Generate a ' +
        'real one:\n' +
        "  node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    )
  }

  if (s.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${s.length}).`,
    )
  }

}

function secret(): Uint8Array {
  const s = process.env.JWT_SECRET
  assertUsableSecret(s)
  return new TextEncoder().encode(s)
}

export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
  department: string | null
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret())
}

export async function readSessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    if (!payload.id || !payload.role) return null
    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      department: payload.department ? String(payload.department) : null,
    }
  } catch {
    // Expired, tampered, or wrong secret — all mean "no session".
    return null
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

/** The current user, or null. Re-reads the DB so deactivated users lose access immediately. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null

  const session = await readSessionToken(token)
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, name: true, role: true, department: true, isActive: true },
  })
  if (!user || !user.isActive) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    department: user.department,
  }
}

/** Like getCurrentUser but throws — for API routes that require a session. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) throw new AuthError('Not authenticated', 401)
  return user
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 403,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export { COOKIE_NAME }
