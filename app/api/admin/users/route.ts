import { prisma } from '@/lib/db'
import { AuthError, hashPassword, requireUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { createUserSchema } from '@/lib/validation'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'

// passwordHash is never in a select — it must not reach the client even once.
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

export async function GET() {
  try {
    const user = await requireUser()
    if (!can(user.role, 'user:read')) {
      throw new AuthError('Administrator access required', 403)
    }

    const users = await prisma.user.findMany({
      select: USER_SELECT,
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    })

    return json({ users, total: users.length })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const actor = await requireUser()
    if (!can(actor.role, 'user:write')) {
      throw new AuthError('Administrator access required', 403)
    }

    const input = createUserSchema.parse(await readJsonBody(req))
    const email = input.email.toLowerCase().trim()

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) throw new AuthError('A user with that email already exists', 409)

    const created = await prisma.user.create({
      data: {
        email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
        role: input.role,
        department: input.department ?? null,
        employeeCode: input.employeeCode || null,
        phone: input.phone || null,
      },
      select: USER_SELECT,
    })

    return json({ user: created }, 201)
  } catch (e) {
    return handleApiError(e)
  }
}
