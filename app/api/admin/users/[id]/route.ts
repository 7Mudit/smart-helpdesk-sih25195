import { prisma } from '@/lib/db'
import { AuthError, requireUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { updateUserSchema } from '@/lib/validation'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  department: true,
  employeeCode: true,
  phone: true,
  isActive: true,
  createdAt: true,
} as const

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const actor = await requireUser()
    if (!can(actor.role, 'user:write')) {
      throw new AuthError('Administrator access required', 403)
    }

    const { id } = await params
    const input = updateUserSchema.parse(await readJsonBody(req))

    const target = await prisma.user.findUnique({ where: { id } })
    if (!target) throw new AuthError('User not found', 404)

    // Guard rails against an admin locking themselves out of the system.
    if (target.id === actor.id) {
      if (input.isActive === false) {
        throw new AuthError('You cannot deactivate your own account', 400)
      }
      if (input.role && input.role !== 'ADMIN') {
        throw new AuthError('You cannot remove your own administrator role', 400)
      }
    }

    if (input.email) {
      const email = input.email.toLowerCase().trim()
      const clash = await prisma.user.findUnique({ where: { email } })
      if (clash && clash.id !== id) {
        throw new AuthError('A user with that email already exists', 409)
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(input.email !== undefined && { email: input.email.toLowerCase().trim() }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.department !== undefined && { department: input.department }),
        ...(input.employeeCode !== undefined && {
          employeeCode: input.employeeCode || null,
        }),
        ...(input.phone !== undefined && { phone: input.phone || null }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      select: USER_SELECT,
    })

    return json({ user: updated })
  } catch (e) {
    return handleApiError(e)
  }
}
