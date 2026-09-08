'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Eye, Pencil, Plus, Search, ThumbsUp } from 'lucide-react'
import { CATEGORIES, LABELS, type Category } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField, Input, Select, Textarea } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'

export interface AdminArticle {
  id: string
  slug: string
  title: string
  body: string
  category: string
  tags: string
  isPublished: boolean
  viewCount: number
  helpfulCount: number
  notHelpfulCount: number
  deflectionCount: number
  updatedAt: string
  authorName: string
}

async function errorFrom(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: string
      issues?: { path: string; message: string }[]
    }
    if (body.issues?.length) return body.issues.map((i) => `${i.path}: ${i.message}`).join(', ')
    return body.error ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

interface ArticleForm {
  title: string
  category: string
  tags: string
  body: string
  isPublished: boolean
}

const EMPTY_ARTICLE: ArticleForm = {
  title: '',
  category: 'HARDWARE',
  tags: '',
  body: '',
  isPublished: false,
}

/** helpful / (helpful + not helpful), or null when nobody has voted. */
function helpfulRatio(a: AdminArticle): number | null {
  const total = a.helpfulCount + a.notHelpfulCount
  if (total === 0) return null
  return Math.round((a.helpfulCount / total) * 100)
}

export function KbManager({ articles }: { articles: AdminArticle[] }) {
  const router = useRouter()
  const { toast } = useToast()

  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('ALL')

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AdminArticle | null>(null)
  const [form, setForm] = React.useState<ArticleForm>(EMPTY_ARTICLE)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return articles.filter((a) => {
      if (statusFilter === 'PUBLISHED' && !a.isPublished) return false
      if (statusFilter === 'DRAFT' && a.isPublished) return false
      if (!q) return true
      return (
        a.title.toLowerCase().includes(q) ||
        a.tags.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q)
      )
    })
  }, [articles, search, statusFilter])

  function openCreate() {
    setForm(EMPTY_ARTICLE)
    setError(null)
    setCreateOpen(true)
  }

  function openEdit(a: AdminArticle) {
    setForm({
      title: a.title,
      category: a.category,
      tags: a.tags,
      body: a.body,
      isPublished: a.isPublished,
    })
    setError(null)
    setEditing(a)
  }

  function close() {
    setCreateOpen(false)
    setEditing(null)
    setError(null)
  }

  function validate(): string | null {
    if (form.title.trim().length < 5) return 'Title must be at least 5 characters.'
    if (form.body.trim().length < 20) return 'Article body must be at least 20 characters.'
    return null
  }

  async function submitCreate() {
    const invalid = validate()
    if (invalid) {
      setError(invalid)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/kb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      toast(`"${form.title}" created`, 'success')
      close()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the article')
    } finally {
      setSaving(false)
    }
  }

  async function submitEdit() {
    if (!editing) return
    const invalid = validate()
    if (invalid) {
      setError(invalid)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/kb/${editing.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      toast(`"${form.title}" saved`, 'success')
      close()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the article')
    } finally {
      setSaving(false)
    }
  }

  const publishedCount = articles.filter((a) => a.isPublished).length
  const totalDeflections = articles.reduce((s, a) => s + a.deflectionCount, 0)

  const fields = (mode: 'create' | 'edit') => (
    <div className="flex flex-col gap-4">
      <FormField label="Title" htmlFor={`${mode}-kb-title`} required>
        <Input
          id={`${mode}-kb-title`}
          value={form.title}
          placeholder="How to reset your SAP password"
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Category" htmlFor={`${mode}-kb-category`} required>
          <Select
            id={`${mode}-kb-category`}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {LABELS.category[c as Category]}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          label="Tags"
          htmlFor={`${mode}-kb-tags`}
          hint="Comma-separated. Used by the suggestion engine."
        >
          <Input
            id={`${mode}-kb-tags`}
            value={form.tags}
            placeholder="sap, password, reset"
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
        </FormField>
      </div>

      <FormField
        label="Body (Markdown)"
        htmlFor={`${mode}-kb-body`}
        required
        hint="Headings, lists and code fences are supported."
      >
        <Textarea
          id={`${mode}-kb-body`}
          rows={14}
          value={form.body}
          placeholder={'## Steps\n\n1. Open the portal\n2. Click "Forgot password"'}
          className="font-mono text-xs leading-5"
          onChange={(e) => setForm({ ...form, body: e.target.value })}
        />
      </FormField>

      <label className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
        <input
          type="checkbox"
          checked={form.isPublished}
          onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">Published</span>
          <span className="text-xs text-muted-foreground">
            Only published articles are searchable and suggested on the ticket form.
          </span>
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  )

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-2">
            <label htmlFor="kb-search" className="text-sm font-medium text-foreground">
              Search
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="kb-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title, tag or category"
                className="w-full pl-9 sm:w-72"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="kb-status" className="text-sm font-medium text-foreground">
              Status
            </label>
            <Select
              id="kb-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-40"
            >
              <option value="ALL">All articles</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Drafts</option>
            </Select>
          </div>
        </div>

        <Button onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          New article
        </Button>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {filtered.length} of {articles.length} articles · {publishedCount} published ·{' '}
        {totalDeflections} tickets deflected
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="No articles match"
          description="Try a different search term, or write the first article for this category."
          action={
            <Button onClick={openCreate}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              New article
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Article</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Views</TableHead>
              <TableHead className="text-right">Helpful</TableHead>
              <TableHead className="text-right">Deflected</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => {
              const ratio = helpfulRatio(a)
              return (
                <TableRow key={a.id}>
                  <TableCell className="max-w-[20rem]">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <Link
                        href={`/kb/${a.slug}`}
                        className="truncate font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {a.title}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">
                        by {a.authorName}
                        {a.tags.trim() ? ` · ${a.tags}` : ''}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant="outline">
                      {LABELS.category[a.category as Category] ?? a.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.isPublished ? 'success' : 'secondary'}>
                      {a.isPublished ? 'Published' : 'Draft'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                      {a.viewCount}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {ratio === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={
                          ratio >= 70
                            ? 'inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400'
                            : ratio >= 40
                              ? 'inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400'
                              : 'inline-flex items-center gap-1.5 font-medium text-red-600 dark:text-red-400'
                        }
                      >
                        <ThumbsUp aria-hidden="true" className="h-3.5 w-3.5" />
                        {ratio}%
                        <span className="sr-only">
                          helpful, {a.helpfulCount} of {a.helpfulCount + a.notHelpfulCount} votes
                        </span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-foreground">
                    {a.deflectionCount}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(a.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(a)}
                      aria-label={`Edit ${a.title}`}
                    >
                      <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={createOpen}
        onClose={close}
        title="New article"
        description="Write it in Markdown. Publish when it is ready to be suggested."
        className="max-w-3xl"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void submitCreate()}>
              Create article
            </Button>
          </>
        }
      >
        {fields('create')}
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={close}
        title="Edit article"
        description={
          editing
            ? `${editing.viewCount} views · ${editing.deflectionCount} tickets deflected`
            : undefined
        }
        className="max-w-3xl"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void submitEdit()}>
              Save article
            </Button>
          </>
        }
      >
        {fields('edit')}
      </Dialog>
    </>
  )
}
