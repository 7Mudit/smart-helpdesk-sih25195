import { clearSessionCookie } from '@/lib/auth'
import { handleApiError, json } from '@/lib/api-utils'

export async function POST() {
  try {
    await clearSessionCookie()
    return json({ ok: true })
  } catch (e) {
    return handleApiError(e)
  }
}
