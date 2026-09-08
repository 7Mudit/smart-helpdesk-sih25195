import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/rbac'
import { KbManager, type AdminArticle } from './kb-manager'

export const dynamic = 'force-dynamic'

export default async function AdminKbPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!can(user.role, 'kb:write')) redirect('/tickets')

  const rows = await prisma.kbArticle.findMany({
    orderBy: [{ isPublished: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      slug: true,
      title: true,
      body: true,
      category: true,
      tags: true,
      isPublished: true,
      viewCount: true,
      helpfulCount: true,
      notHelpfulCount: true,
      deflectionCount: true,
      updatedAt: true,
      author: { select: { name: true } },
    },
  })

  const articles: AdminArticle[] = rows.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.title,
    body: a.body,
    category: a.category,
    tags: a.tags,
    isPublished: a.isPublished,
    viewCount: a.viewCount,
    helpfulCount: a.helpfulCount,
    notHelpfulCount: a.notHelpfulCount,
    deflectionCount: a.deflectionCount,
    updatedAt: a.updatedAt.toISOString(),
    authorName: a.author.name,
  }))

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Knowledge base
        </h1>
        <p className="text-sm text-muted-foreground">
          Published articles are suggested to requesters as they type — every one that lands
          deflects a ticket.
        </p>
      </header>

      <KbManager articles={articles} />
    </div>
  )
}
