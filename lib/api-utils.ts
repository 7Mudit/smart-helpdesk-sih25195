import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AuthError } from './auth'

/** Uniform JSON responder so every route serialises the same way. */
export function json<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status })
}

/**
 * The single error funnel for every API route.
 *
 * Known, expected failures (auth/authorisation, bad input) surface with a
 * useful message. Everything else is logged server-side and returned as an
 * opaque 500 — a stack trace on the wire is an information leak, and this is
 * a government IT system.
 */
export function handleApiError(e: unknown): NextResponse {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }

  if (e instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        issues: e.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    )
  }

  console.error('[api] unhandled error:', e)
  return NextResponse.json(
    { error: 'Something went wrong. Please try again.' },
    { status: 500 },
  )
}

/** Parse a URLSearchParams into a plain object for Zod, dropping empty values. */
export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of params.entries()) {
    if (value !== '') out[key] = value
  }
  return out
}

/** Body parser that turns a malformed/absent JSON body into a clean 400. */
export async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    throw new AuthError('Request body must be valid JSON', 400)
  }
}
