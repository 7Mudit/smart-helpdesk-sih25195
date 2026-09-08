import { requireUser } from '@/lib/auth'
import { createCommentSchema } from '@/lib/validation'
import { addComment } from '@/lib/services/ticket-service'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    const { id } = await params
    const input = createCommentSchema.parse(await readJsonBody(req))
    return json({ comment: await addComment(id, input, user) }, 201)
  } catch (e) {
    return handleApiError(e)
  }
}
