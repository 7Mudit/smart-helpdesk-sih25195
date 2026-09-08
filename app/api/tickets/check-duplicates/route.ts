import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { findDuplicates } from '@/lib/automation/duplicates'
import { recentOpenTicketsFor } from '@/lib/services/ticket-service'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'

// The draft is not a saved ticket yet, so the create-schema's length floors
// would reject a half-typed title. This runs on every keystroke-debounce.
const draftSchema = z.object({
  title: z.string().trim().max(150).default(''),
  description: z.string().trim().max(5000).default(''),
})

export async function POST(req: Request) {
  try {
    const user = await requireUser()
    const draft = draftSchema.parse(await readJsonBody(req))

    // Scoped to the caller's own recent open tickets: telling an employee
    // their draft resembles a colleague's ticket would leak that ticket.
    const corpus = await recentOpenTicketsFor(user.id)

    return json({ duplicates: findDuplicates(draft, corpus) })
  } catch (e) {
    return handleApiError(e)
  }
}
