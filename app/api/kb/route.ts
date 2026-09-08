import { prisma } from '@/lib/db'
import { insensitiveContains } from '@/lib/search-filter'
import { requireUser } from '@/lib/auth'
import { can } from '@/lib/rbac'
import { AuthError } from '@/lib/auth'
import { CATEGORIES } from '@/lib/constants'
import { suggestArticles } from '@/lib/automation/kb-suggest'
import { handleApiError, json, readJsonBody } from '@/lib/api-utils'
import { kbArticleSchema } from '@/lib/validation'

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  category: true,
  tags: true,
  viewCount: true,
  helpfulCount: true,
  notHelpfulCount: true,
  updatedAt: true,
} as const

export async function GET(req: Request) {
  try {
    const user = await requireUser()
    if (!can(user.role, 'kb:read')) {
      throw new AuthError('You are not allowed to read the knowledge base', 403)
    }

    const url = new URL(req.url)
    const q = url.searchParams.get('q')?.trim() ?? ''
    const suggest = url.searchParams.get('suggest')?.trim() ?? ''
    const categoryParam = url.searchParams.get('category')?.trim() ?? ''

    // --- TF-IDF suggestion mode (ticket form widget)
    if (suggest) {
      const articles = await prisma.kbArticle.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          slug: true,
          title: true,
          body: true,
          tags: true,
          category: true,
        },
      })
      return json({ suggestions: suggestArticles(suggest, articles, 3) })
    }

    // --- browse / search mode
    const where: Record<string, unknown> = { isPublished: true }

    if (categoryParam && (CATEGORIES as readonly string[]).includes(categoryParam)) {
      where.category = categoryParam
    }

    if (q) {
      // insensitiveContains adapts to the datasource — Postgres needs
      // mode: 'insensitive', SQLite's LIKE is already case-insensitive.
      const term = insensitiveContains(q)
      where.OR = [{ title: term }, { body: term }, { tags: term }]
    }

    const articles = await prisma.kbArticle.findMany({
      where,
      select: LIST_SELECT,
      orderBy: q ? { viewCount: 'desc' } : [{ category: 'asc' }, { title: 'asc' }],
      take: 100,
    })

    return json({ articles, total: articles.length })
  } catch (e) {
    return handleApiError(e)
  }
}

/**
 * Turn a title into a URL slug. Uniqueness is handled by the caller, which
 * appends a numeric suffix when the base slug is taken.
 */
function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'article'
  )
}

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base
  for (let i = 2; i < 100; i++) {
    const clash = await prisma.kbArticle.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!clash) return candidate
    candidate = `${base}-${i}`
  }
  // Practically unreachable; keeps the return type honest.
  return `${base}-${Date.now()}`
}

/** Create an article. Admin only — 'kb:write'. */
export async function POST(req: Request) {
  try {
    const user = await requireUser()
    if (!can(user.role, 'kb:write')) {
      throw new AuthError('You are not allowed to author knowledge-base articles', 403)
    }

    const input = kbArticleSchema.parse(await readJsonBody(req))
    const slug = await uniqueSlug(slugify(input.title))

    const article = await prisma.kbArticle.create({
      data: {
        slug,
        title: input.title,
        body: input.body,
        category: input.category,
        tags: input.tags,
        isPublished: input.isPublished,
        authorId: user.id,
      },
      select: { ...LIST_SELECT, isPublished: true, body: true },
    })

    return json({ article }, 201)
  } catch (e) {
    return handleApiError(e)
  }
}
