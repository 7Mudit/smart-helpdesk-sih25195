import { requireUser } from '@/lib/auth'
import { updateTicketSchema } from '@/lib/validation'
import { getTicket, updateTicket } from '@/lib/services/ticket-service'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'

// Next.js 15: route params arrive as a promise.
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    const { id } = await params
    return json({ ticket: await getTicket(id, user) })
  } catch (e) {
    return handleApiError(e)
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    const { id } = await params
    const input = updateTicketSchema.parse(await readJsonBody(req))
    return json({ ticket: await updateTicket(id, input, user) })
  } catch (e) {
    return handleApiError(e)
  }
}
