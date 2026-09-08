import { AuthError, requireUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { getDashboardStats } from '@/lib/services/analytics-service'
import { handleApiError, json } from '@/lib/api-utils'

export async function GET() {
  try {
    const user = await requireUser()
    if (!can(user.role, 'dashboard:view')) {
      throw new AuthError('You are not allowed to view the dashboard', 403)
    }
    return json(await getDashboardStats(user))
  } catch (e) {
    return handleApiError(e)
  }
}
