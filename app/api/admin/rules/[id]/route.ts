import { prisma } from '@/lib/db'
import { AuthError, requireUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { routingRuleSchema } from '@/lib/validation'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    if (!can(user.role, 'rule:write')) {
      throw new AuthError('Administrator access required', 403)
    }

    const { id } = await params
    const input = routingRuleSchema.partial().parse(await readJsonBody(req))

    const existing = await prisma.routingRule.findUnique({ where: { id } })
    if (!existing) throw new AuthError('Routing rule not found', 404)

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

    const rule = await prisma.routingRule.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.matchCategory !== undefined && {
          matchCategory: input.matchCategory ?? null,
        }),
        ...(input.matchKeywords !== undefined && {
          matchKeywords: input.matchKeywords,
        }),
        ...(input.matchPriority !== undefined && {
          matchPriority: input.matchPriority ?? null,
        }),
        ...(input.assignDepartment !== undefined && {
          assignDepartment: input.assignDepartment,
        }),
        ...(input.assignToUserId !== undefined && {
          assignToUserId: input.assignToUserId ?? null,
        }),
        ...(input.setPriority !== undefined && {
          setPriority: input.setPriority ?? null,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: { assignTo: { select: { id: true, name: true, email: true } } },
    })

    return json({ rule })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    if (!can(user.role, 'rule:write')) {
      throw new AuthError('Administrator access required', 403)
    }

    const { id } = await params

    const existing = await prisma.routingRule.findUnique({ where: { id } })
    if (!existing) throw new AuthError('Routing rule not found', 404)

    await prisma.routingRule.delete({ where: { id } })

    return json({ ok: true, id })
  } catch (e) {
    return handleApiError(e)
  }
}
