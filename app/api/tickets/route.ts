import { requireUser } from '@/lib/auth'
import { createTicketSchema, ticketFilterSchema } from '@/lib/validation'
import { createTicket, listTickets } from '@/lib/services/ticket-service'
import {
  handleApiError,
  json,
  readJsonBody,
  searchParamsToObject,
} from '@/lib/api-utils'

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    const url = new URL(req.url)
    const filter = ticketFilterSchema.parse(searchParamsToObject(url.searchParams))
    return json(await listTickets(filter, user))
  } catch (e) {
    return handleApiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const input = createTicketSchema.parse(await readJsonBody(req))
    return json({ ticket: await createTicket(input, user) }, 201)
  } catch (e) {
    return handleApiError(e)
  }
}
