import { z } from 'zod'
import { prisma } from '@/lib/db'
import { AuthError, requireUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'

const voteSchema = z.object({ helpful: z.boolean() })

type Ctx = { params: Promise<{ slug: string }> }

export async function POST(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    if (!can(user.role, 'kb:read')) {
      throw new AuthError('You are not allowed to vote on articles', 403)
    }

    const { slug } = await params
    const { helpful } = voteSchema.parse(await readJsonBody(req))

    const article = await prisma.kbArticle.findUnique({
      where: { slug },
      select: { id: true, isPublished: true },
    })
    if (!article || !article.isPublished) {
      throw new AuthError('Article not found', 404)
    }

    const updated = await prisma.kbArticle.update({
      where: { id: article.id },
      data: helpful
        ? { helpfulCount: { increment: 1 } }
        : { notHelpfulCount: { increment: 1 } },
      select: {
        id: true,
        slug: true,
        helpfulCount: true,
        notHelpfulCount: true,
      },
    })

    return json({ article: updated })
  } catch (e) {
    return handleApiError(e)
  }
}
