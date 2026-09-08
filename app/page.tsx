import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { can } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

/** Role-aware landing: everyone starts where their work actually is. */
export default async function RootPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  redirect(can(user.role, 'dashboard:view') ? '/dashboard' : '/tickets')
}
