import { prisma } from '@/lib/db'
import { AuthError, requireUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { slaPolicySchema } from '@/lib/validation'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'
import { PRIORITY_RANK, type Priority } from '@/lib/constants'

/** Agents need to read policies to explain a deadline; only admins may edit. */
export async function GET() {
  try {
    const user = await requireUser()
    if (!can(user.role, 'sla:read')) {
      throw new AuthError('You are not allowed to view SLA policies', 403)
    }

    const policies = await prisma.slaPolicy.findMany()
    policies.sort(
      (a, b) =>
        (PRIORITY_RANK[b.priority as Priority] ?? 0) -
        (PRIORITY_RANK[a.priority as Priority] ?? 0),
    )

    return json({ policies })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    if (!can(user.role, 'sla:write')) {
      throw new AuthError('Administrator access required', 403)
    }

    const input = slaPolicySchema.parse(await readJsonBody(req))

    // `priority` is UNIQUE in the schema — one policy per level. Creating for
    // an existing level updates it rather than failing on the constraint.
    const policy = await prisma.slaPolicy.upsert({
      where: { priority: input.priority },
      create: input,
      update: input,
    })

    return json({ policy }, 201)
  } catch (e) {
    return handleApiError(e)
  }
}
