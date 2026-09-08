import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Eye, PlusCircle } from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LABELS, type Category } from '@/lib/constants'
import { prisma } from '@/lib/db'
import { formatDateTime } from '@/lib/utils'
import { VoteButtons } from './vote-buttons'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await prisma.kbArticle.findUnique({
    where: { slug },
    select: { title: true },
  })
  return { title: article ? `${article.title} — Knowledge Base` : 'Article — Knowledge Base' }
}

export default async function KbArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const article = await prisma.kbArticle.findUnique({
    where: { slug },
    include: { author: { select: { name: true } } },
  })

  if (!article || !article.isPublished) notFound()

  // Server-side view counting. Failure must never break the read path.
  const viewCount = await prisma.kbArticle
    .update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    })
    .then((r) => r.viewCount)
    .catch(() => article.viewCount)

  const tags = article.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  const related = await prisma.kbArticle.findMany({
    where: { isPublished: true, category: article.category, id: { not: article.id } },
    select: { id: true, slug: true, title: true },
    orderBy: { viewCount: 'desc' },
    take: 4,
  })

  return (
    <div className="mx-auto flex w-full max-w-[85rem] flex-col gap-6">
      <Link
        href="/kb"
        className="w-fit rounded text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ← Back to the knowledge base
      </Link>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                {LABELS.category[article.category as Category] ?? article.category}
              </Badge>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                {viewCount.toLocaleString('en-IN')} view{viewCount === 1 ? '' : 's'}
              </span>
            </div>

            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
              {article.title}
            </h1>

            <p className="text-sm text-muted-foreground">
              By {article.author.name} · Updated {formatDateTime(article.updatedAt)}
            </p>
          </header>

          <Card>
            <CardContent className="p-6">
              <article>
                <Markdown content={article.body} />
              </article>
            </CardContent>
          </Card>

          {tags.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tags
              </span>
              {tags.map((tag) => (
                <Link key={tag} href={`/kb?q=${encodeURIComponent(tag)}`}>
                  <Badge variant="outline" className="hover:bg-accent">
                    {tag}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : null}

          <VoteButtons
            slug={article.slug}
            helpfulCount={article.helpfulCount}
            notHelpfulCount={article.notHelpfulCount}
          />
        </div>

        <aside aria-label="Related articles and actions" className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Still stuck?</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                If this article did not solve the problem, raise a ticket and an agent will pick it
                up.
              </p>
              <Link
                href="/tickets/new"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <PlusCircle aria-hidden="true" className="h-4 w-4" />
                Raise a ticket
              </Link>
            </CardContent>
          </Card>

          {related.length > 0 ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Related articles</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/kb/${r.slug}`}
                        className="block rounded-md border border-border px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {r.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
