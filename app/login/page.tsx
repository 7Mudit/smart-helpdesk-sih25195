import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { getCurrentUser } from '@/lib/auth'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Sign in — Smart Helpdesk' }

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  // Already signed in? The root route knows where each role belongs.
  const user = await getCurrentUser()
  if (user) redirect('/')

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <main
        id="main"
        className="flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0"
      >
        <div className="flex w-full max-w-md flex-col gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"
            >
              <Zap className="h-6 w-6" />
            </span>
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Smart Helpdesk
              </h1>
              <p className="text-sm text-muted-foreground">
                IT Service Desk · Ministry of Power, Government of India
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="p-6">
              <LoginForm />
            </CardContent>
          </Card>

          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Demo accounts use the password{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              password123
            </code>
            . SIH25195 · Smart Automation.
          </p>
        </div>
      </main>
    </div>
  )
}
