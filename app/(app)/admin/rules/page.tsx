import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/rbac'
import { RulesManager, type AdminRule, type RuleAssignee } from './rules-manager'

export const dynamic = 'force-dynamic'

export default async function AdminRulesPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!can(user.role, 'rule:write')) redirect('/tickets')

  const [rows, agentRows] = await Promise.all([
    prisma.routingRule.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        priority: true,
        matchCategory: true,
        matchKeywords: true,
        matchPriority: true,
        assignDepartment: true,
        assignToUserId: true,
        setPriority: true,
        isActive: true,
        assignTo: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ['AGENT', 'ADMIN'] }, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, department: true },
    }),
  ])

  const rules: AdminRule[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    priority: r.priority,
    matchCategory: r.matchCategory,
    matchKeywords: r.matchKeywords,
    matchPriority: r.matchPriority,
    assignDepartment: r.assignDepartment,
    assignToUserId: r.assignToUserId,
    assignToName: r.assignTo?.name ?? null,
    setPriority: r.setPriority,
    isActive: r.isActive,
  }))

  const agents: RuleAssignee[] = agentRows.map((a) => ({
    id: a.id,
    name: a.name,
    department: a.department,
  }))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Routing rules</h1>
        <p className="text-sm text-muted-foreground">
          Decide which department and agent picks up a ticket the moment it is raised.
        </p>
      </header>

      <RulesManager rules={rules} agents={agents} />
    </div>
  )
}
