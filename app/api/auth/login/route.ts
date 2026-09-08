import { prisma } from '@/lib/db'
import {
  AuthError,
  createSessionToken,
  setSessionCookie,
  verifyPassword,
} from '@/lib/auth'
import { loginSchema } from '@/lib/validation'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'
import type { Role } from '@/lib/constants'

// A wrong email and a wrong password are indistinguishable to the caller,
// and both cost roughly one bcrypt compare — so this endpoint cannot be used
// to enumerate which government email addresses hold accounts.
const GENERIC_FAILURE = 'Invalid email or password'
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.wJmVYQ6Zx5ZJ8Kf1oJfIhWkGvTFO'

export async function POST(req: Request) {
  try {
    const { email, password } = loginSchema.parse(await readJsonBody(req))

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    // Always run a compare, even with no user, to keep the timing profile flat.
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH)

    if (!user || !ok) throw new AuthError(GENERIC_FAILURE, 401)

    if (!user.isActive) {
      throw new AuthError(
        'This account has been deactivated. Contact your IT administrator.',
        403,
      )
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      department: user.department,
    }

    await setSessionCookie(await createSessionToken(sessionUser))

    return json({ user: sessionUser })
  } catch (e) {
    return handleApiError(e)
  }
}
