import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { classifyTicket } from '@/lib/automation/classifier'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'

// Live preview in the ticket form, so partial text must be accepted.
const draftSchema = z.object({
  title: z.string().trim().max(150).default(''),
  description: z.string().trim().max(5000).default(''),
})

export async function POST(req: Request) {
  try {
    await requireUser()
    const { title, description } = draftSchema.parse(await readJsonBody(req))
    return json(classifyTicket(title, description))
  } catch (e) {
    return handleApiError(e)
  }
}
