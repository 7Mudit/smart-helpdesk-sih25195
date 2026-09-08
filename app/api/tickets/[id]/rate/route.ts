import { requireUser } from '@/lib/auth'
import { rateTicketSchema } from '@/lib/validation'
import { rateTicket } from '@/lib/services/ticket-service'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    const { id } = await params
    const input = rateTicketSchema.parse(await readJsonBody(req))
    return json({ ticket: await rateTicket(id, input, user) })
  } catch (e) {
    return handleApiError(e)
  }
}
