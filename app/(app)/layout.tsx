import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * Every signed-in page lives in this group. The session check here is a
 * convenience for redirects — the real authorisation happens per-query and
 * in the API routes.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <AppShell user={user}>{children}</AppShell>
}
