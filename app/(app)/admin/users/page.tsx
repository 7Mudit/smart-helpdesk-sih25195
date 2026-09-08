import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/rbac'
import { UsersManager, type AdminUser } from './users-manager'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!can(user.role, 'user:read')) redirect('/tickets')

  const rows = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: true,
      employeeCode: true,
      phone: true,
      isActive: true,
      createdAt: true,
      _count: { select: { assignedTickets: true } },
    },
  })

  const users: AdminUser[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    department: u.department,
    employeeCode: u.employeeCode,
    phone: u.phone,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    assignedCount: u._count.assignedTickets,
  }))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Users</h1>
        <p className="text-sm text-muted-foreground">
          Accounts, roles and department assignment for the service desk.
        </p>
      </header>

      <UsersManager initialUsers={users} currentUserId={user.id} />
    </div>
  )
}
