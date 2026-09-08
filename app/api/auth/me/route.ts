import { getCurrentUser } from '@/lib/auth'
import { handleApiError, json } from '@/lib/api-utils'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return json({ error: 'Not authenticated' }, 401)
    return json({ user })
  } catch (e) {
    return handleApiError(e)
  }
}
