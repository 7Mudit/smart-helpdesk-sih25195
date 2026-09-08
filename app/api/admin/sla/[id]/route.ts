import { prisma } from '@/lib/db'
import { AuthError, requireUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { slaPolicySchema } from '@/lib/validation'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    if (!can(user.role, 'sla:write')) {
      throw new AuthError('Administrator access required', 403)
    }

    const { id } = await params
    const input = slaPolicySchema.partial().parse(await readJsonBody(req))

    const existing = await prisma.slaPolicy.findUnique({ where: { id } })
    if (!existing) throw new AuthError('SLA policy not found', 404)

    if (input.priority && input.priority !== existing.priority) {
      const clash = await prisma.slaPolicy.findUnique({
        where: { priority: input.priority },
      })
      if (clash) {
        throw new AuthError(
          'A policy already exists for that priority level',
          409,
        )
      }
    }

    const policy = await prisma.slaPolicy.update({ where: { id }, data: input })

    // Existing tickets keep their snapshotted deadlines on purpose: a ministry
    // audit must be able to show the SLA that applied when the ticket was
    // raised, not the one edited afterwards.
    return json({ policy })
  } catch (e) {
    return handleApiError(e)
  }
}
