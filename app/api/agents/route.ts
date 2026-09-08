import { prisma } from '@/lib/db'
import { AuthError, requireUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { handleApiError, json } from '@/lib/api-utils'

/**
 * Assignable staff for the ticket-page assignee dropdown. Gated on
 * `ticket:assign` — an employee has no reason to enumerate the IT team.
 */
export async function GET() {
  try {
    const user = await requireUser()
    if (!can(user.role, 'ticket:assign')) {
      throw new AuthError('You are not allowed to assign tickets', 403)
    }

    const agents = await prisma.user.findMany({
      where: { role: { in: ['AGENT', 'ADMIN'] }, isActive: true },
      select: { id: true, name: true, department: true, role: true },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
    })

    return json({ agents })
  } catch (e) {
    return handleApiError(e)
  }
}
