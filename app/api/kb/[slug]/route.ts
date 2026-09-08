import { prisma } from '@/lib/db'
import { AuthError, requireUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'
import { kbArticleSchema } from '@/lib/validation'

type Ctx = { params: Promise<{ slug: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    if (!can(user.role, 'kb:read')) {
      throw new AuthError('You are not allowed to read the knowledge base', 403)
    }

    const { slug } = await params

    const article = await prisma.kbArticle.findUnique({
      where: { slug },
      include: { author: { select: { id: true, name: true } } },
    })

    // Unpublished drafts are visible only to authors (admins).
    if (!article || (!article.isPublished && !can(user.role, 'kb:write'))) {
      throw new AuthError('Article not found', 404)
    }

    // Reading is what an article is for — count it. Doing this after the
    // authorisation check means a 404 probe cannot inflate the counter.
    const updated = await prisma.kbArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
      include: { author: { select: { id: true, name: true } } },
    })

    return json({ article: updated })
  } catch (e) {
    return handleApiError(e)
  }
}

/** Update an article. Admin only — 'kb:write'. */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    if (!can(user.role, 'kb:write')) {
      throw new AuthError('You are not allowed to edit knowledge-base articles', 403)
    }

    const { slug } = await params
    const existing = await prisma.kbArticle.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!existing) throw new AuthError('Article not found', 404)

    // Partial so a publish toggle need not resend the whole body.
    const input = kbArticleSchema.partial().parse(await readJsonBody(req))

    const article = await prisma.kbArticle.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined && { title: input.title }),
        ...(input.body !== undefined && { body: input.body }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.isPublished !== undefined && { isPublished: input.isPublished }),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        tags: true,
        isPublished: true,
        updatedAt: true,
      },
    })

    return json({ article })
  } catch (e) {
    return handleApiError(e)
  }
}

/**
 * Delete an article. Admin only.
 *
 * Articles are reference material rather than records of what happened, so a
 * hard delete is appropriate here — unlike tickets and their audit events,
 * which are never destroyed.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await requireUser()
    if (!can(user.role, 'kb:write')) {
      throw new AuthError('You are not allowed to delete knowledge-base articles', 403)
    }

    const { slug } = await params
    const existing = await prisma.kbArticle.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!existing) throw new AuthError('Article not found', 404)

    await prisma.kbArticle.delete({ where: { id: existing.id } })
    return json({ deleted: true })
  } catch (e) {
    return handleApiError(e)
  }
}
