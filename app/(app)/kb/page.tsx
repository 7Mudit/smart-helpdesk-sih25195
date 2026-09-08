import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { BookOpen, Eye, SearchX, ThumbsUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { CATEGORIES, LABELS, type Category } from '@/lib/constants'
import { prisma } from '@/lib/db'
import { cn } from '@/lib/utils'
import { KbSearch } from './kb-search'

export const metadata: Metadata = { title: 'Knowledge Base — Smart Helpdesk' }
export const dynamic = 'force-dynamic'

type SearchParams = Record<string, string | string[] | undefined>

function one(params: SearchParams, key: string): string | undefined {
  const v = params[key]
  return Array.isArray(v) ? v[0] : v
}

/** Strips markdown syntax down to a readable one-line preview. */
function excerpt(body: string, length = 160): string {
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > length ? `${plain.slice(0, length).trimEnd()}…` : plain
}

export default async function KbPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const q = (one(params, 'q') ?? '').trim().slice(0, 200)
  const rawCategory = one(params, 'category')
  const category = (CATEGORIES as readonly string[]).includes(rawCategory ?? '')
    ? (rawCategory as Category)
    : undefined

  const where: Prisma.KbArticleWhereInput = {
    isPublished: true,
    ...(category ? { category } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { body: { contains: q } },
            { tags: { contains: q } },
          ],
        }
      : {}),
  }

  const [articles, counts] = await Promise.all([
    prisma.kbArticle.findMany({
      where,
      orderBy: [{ viewCount: 'desc' }, { title: 'asc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        body: true,
        category: true,
        tags: true,
        viewCount: true,
        helpfulCount: true,
      },
    }),
    prisma.kbArticle.groupBy({
      by: ['category'],
      where: { isPublished: true },
      _count: { _all: true },
    }),
  ])

  const countByCategory = new Map(counts.map((c) => [c.category, c._count._all]))
  const totalPublished = counts.reduce((sum, c) => sum + c._count._all, 0)
  const filtered = Boolean(q || category)

  function chipHref(target: Category | null): string {
    const next = new URLSearchParams()
    if (q) next.set('q', q)
    if (target) next.set('category', target)
    const s = next.toString()
    return s ? `/kb?${s}` : '/kb'
  }

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalPublished} published article{totalPublished === 1 ? '' : 's'} — many issues can be
            fixed without raising a ticket.
          </p>
        </div>

        <KbSearch />
      </div>

      <nav aria-label="Filter articles by category" className="flex flex-wrap gap-2">
        <CategoryChip href={chipHref(null)} active={!category} label="All" count={totalPublished} />
        {CATEGORIES.map((c) => {
          const count = countByCategory.get(c) ?? 0
          if (count === 0) return null
          return (
            <CategoryChip
              key={c}
              href={chipHref(c)}
              active={category === c}
              label={LABELS.category[c]}
              count={count}
            />
          )
        })}
      </nav>

      {articles.length === 0 ? (
        <EmptyState
          icon={filtered ? <SearchX className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
          title={filtered ? 'No articles match your search' : 'No articles published yet'}
          description={
            filtered
              ? 'Try a different keyword, or browse all categories.'
              : 'Published knowledge-base articles will appear here.'
          }
          action={
            filtered ? (
              <Link
                href="/kb"
                className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Clear filters
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {articles.map((a) => (
            <li key={a.id} className="flex">
              <Link
                href={`/kb/${a.slug}`}
                className="group flex w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="flex w-full flex-col transition-colors group-hover:border-primary/40">
                  <CardHeader className="gap-2 p-5 pb-3">
                    <Badge variant="secondary" className="w-fit">
                      {LABELS.category[a.category as Category] ?? a.category}
                    </Badge>
                    <CardTitle className="text-base leading-6 group-hover:text-primary">
                      {a.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="flex flex-1 flex-col justify-between gap-4 p-5 pt-0">
                    <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {excerpt(a.body)}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                        {a.viewCount.toLocaleString('en-IN')} view
                        {a.viewCount === 1 ? '' : 's'}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <ThumbsUp aria-hidden="true" className="h-3.5 w-3.5" />
                        {a.helpfulCount} found this helpful
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CategoryChip({
  href,
  active,
  label,
  count,
}: {
  href: string
  active: boolean
  label: string
  count: number
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 text-xs font-semibold',
          active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground'
        )}
      >
        {count}
      </span>
      {active ? <span className="sr-only">(selected)</span> : null}
    </Link>
  )
}
