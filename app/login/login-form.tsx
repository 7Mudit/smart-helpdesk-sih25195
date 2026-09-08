'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Headset, ShieldCheck, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormField, Input } from '@/components/ui/input'

const DEMO_PASSWORD = 'password123'

interface DemoAccount {
  label: string
  email: string
  blurb: string
  icon: React.ComponentType<{ className?: string }>
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: 'Sign in as Employee',
    email: 'employee@mop.gov.in',
    blurb: 'Raise and track your own tickets',
    icon: User,
  },
  {
    label: 'Sign in as Agent',
    email: 'agent@mop.gov.in',
    blurb: 'Work the support queue and resolve',
    icon: Headset,
  },
  {
    label: 'Sign in as Admin',
    email: 'admin@mop.gov.in',
    blurb: 'Full analytics, users, SLA and rules',
    icon: ShieldCheck,
  },
]

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})
  /** email of the demo button in flight, or 'form' for the manual submit */
  const [pending, setPending] = React.useState<string | null>(null)

  const submit = React.useCallback(
    async (creds: { email: string; password: string }, key: string) => {
      setPending(key)
      setError(null)
      setFieldErrors({})

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(creds),
        })

        const data: unknown = await res.json().catch(() => null)

        if (!res.ok) {
          const payload = (data ?? {}) as {
            error?: string
            message?: string
            fieldErrors?: Record<string, string[] | string>
          }

          if (payload.fieldErrors) {
            const flat: Record<string, string> = {}
            for (const [k, v] of Object.entries(payload.fieldErrors)) {
              const first = Array.isArray(v) ? v[0] : v
              if (first) flat[k] = first
            }
            setFieldErrors(flat)
          }

          setError(
            payload.error ??
              payload.message ??
              (res.status === 401
                ? 'Incorrect email or password.'
                : 'Sign-in failed. Please try again.')
          )
          setPending(null)
          return
        }

        router.push('/')
        router.refresh()
      } catch {
        setError('Could not reach the server. Is the application running?')
        setPending(null)
      }
    },
    [router]
  )

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit({ email: email.trim(), password }, 'form')
  }

  function onDemo(account: DemoAccount) {
    setEmail(account.email)
    setPassword(DEMO_PASSWORD)
    void submit({ email: account.email, password: DEMO_PASSWORD }, account.email)
  }

  const busy = pending !== null

  return (
    <div className="flex flex-col gap-6">
      {/* Demo logins first — nobody demoing this should ever type a credential. */}
      <section aria-labelledby="demo-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="demo-heading" className="text-sm font-semibold text-foreground">
            One-click demo sign-in
          </h2>
          <p className="text-xs text-muted-foreground">
            Pick a role to explore the system instantly — no credentials needed.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {DEMO_ACCOUNTS.map((account) => {
            const Icon = account.icon
            return (
              <button
                key={account.email}
                type="button"
                onClick={() => onDemo(account)}
                disabled={busy}
                aria-busy={pending === account.email || undefined}
                className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:pointer-events-none disabled:opacity-60"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {account.label}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {pending === account.email ? 'Signing in…' : account.blurb}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          or sign in manually
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        <FormField label="Email address" htmlFor="email" required error={fieldErrors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="you@mop.gov.in"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            aria-invalid={fieldErrors.email ? true : undefined}
            required
          />
        </FormField>

        <FormField label="Password" htmlFor="password" required error={fieldErrors.password}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            aria-invalid={fieldErrors.password ? true : undefined}
            required
          />
        </FormField>

        <Button type="submit" size="lg" loading={pending === 'form'} disabled={busy}>
          Sign in
        </Button>
      </form>
    </div>
  )
}
