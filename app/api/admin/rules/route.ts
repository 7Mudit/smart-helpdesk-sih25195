import { prisma } from '@/lib/db'
import { AuthError, requireUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { routingRuleSchema } from '@/lib/validation'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'

const RULE_INCLUDE = {
  assignTo: { select: { id: true, name: true, email: true } },
} as const

export async function GET() {
  try {
    const user = await requireUser()
    if (!can(user.role, 'rule:read')) {
      throw new AuthError('You are not allowed to view routing rules', 403)
    }

    // Ascending priority is evaluation order — the list IS the rule chain.
    const rules = await prisma.routingRule.findMany({
      include: RULE_INCLUDE,
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    })

    return json({ rules })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    if (!can(user.role, 'rule:write')) {
      throw new AuthError('Administrator access required', 403)
    }

    const input = routingRuleSchema.parse(await readJsonBody(req))

    if (input.assignToUserId) {
      const assignee = await prisma.user.findUnique({
        where: { id: input.assignToUserId },
        select: { id: true, role: true, isActive: true },
      })
      if (!assignee || !assignee.isActive || assignee.role === 'EMPLOYEE') {
        throw new AuthError(
          'A rule can only assign to an active agent or admin',
          400,
        )
      }
    }

    const rule = await prisma.routingRule.create({
      data: {
        name: input.name,
        priority: input.priority,
        matchCategory: input.matchCategory ?? null,
        matchKeywords: input.matchKeywords,
        matchPriority: input.matchPriority ?? null,
        assignDepartment: input.assignDepartment,
        assignToUserId: input.assignToUserId ?? null,
        setPriority: input.setPriority ?? null,
        isActive: input.isActive,
      },
      include: RULE_INCLUDE,
    })

    return json({ rule }, 201)
  } catch (e) {
    return handleApiError(e)
  }
}
