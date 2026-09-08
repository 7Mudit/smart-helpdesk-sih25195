'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  ExternalLink,
  Lightbulb,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FormField, Input, Select, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  CATEGORIES,
  LABELS,
  PRIORITIES,
  type Category,
  type Priority,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

const DEBOUNCE_MS = 500
/** Below this there is not enough text for the automation to say anything useful. */
const MIN_TITLE = 5
const MIN_DESCRIPTION = 10

interface Classification {
  category: Category
  priority: Priority
  confidence: number
  autoClassified: boolean
  matchedTerms: string[]
}

interface Duplicate {
  ticketId: string
  ticketNumber: string
  title: string
  similarity: number
  status: string
}

interface KbSuggestion {
  id: string
  slug: string
  title: string
  score: number
}

/** Tolerates both a bare array/object and a `{ data: … }` / named wrapper. */
function unwrap<T>(payload: unknown, keys: string[]): T | null {
  if (payload === null || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  for (const key of [...keys, 'data', 'result']) {
    if (key in obj && obj[key] !== undefined && obj[key] !== null) return obj[key] as T
  }
  return payload as T
}

export function NewTicketForm() {
  const router = useRouter()
  const { toast } = useToast()

  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [category, setCategory] = React.useState('') // '' = auto-detect
  const [priority, setPriority] = React.useState('') // '' = auto-detect

  const [classification, setClassification] = React.useState<Classification | null>(null)
  const [duplicates, setDuplicates] = React.useState<Duplicate[]>([])
  const [articles, setArticles] = React.useState<KbSuggestion[]>([])
  const [analysing, setAnalysing] = React.useState(false)

  const [submitting, setSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})

  const ready = title.trim().length >= MIN_TITLE && description.trim().length >= MIN_DESCRIPTION

  // --- live automation: debounced on title + description -----------------
  React.useEffect(() => {
    if (!ready) {
      setClassification(null)
      setDuplicates([])
      setArticles([])
      setAnalysing(false)
      return
    }

    const controller = new AbortController()
    setAnalysing(true)

    const timer = setTimeout(() => {
      const body = JSON.stringify({ title: title.trim(), description: description.trim() })
      const post = (url: string) =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
        })

      const classify = post('/api/tickets/classify')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const result = unwrap<Classification>(d, ['classification'])
          if (result && typeof result.category === 'string') setClassification(result)
        })
        .catch(() => {})

      const dupes = post('/api/tickets/check-duplicates')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const result = unwrap<Duplicate[]>(d, ['duplicates', 'candidates'])
          setDuplicates(Array.isArray(result) ? result.slice(0, 4) : [])
        })
        .catch(() => {})

      const kb = fetch(
        `/api/kb?suggest=${encodeURIComponent(`${title.trim()} ${description.trim()}`.slice(0, 500))}`,
        { signal: controller.signal }
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const result = unwrap<KbSuggestion[]>(d, ['suggestions', 'articles'])
          setArticles(Array.isArray(result) ? result.slice(0, 3) : [])
        })
        .catch(() => {})

      void Promise.allSettled([classify, dupes, kb]).then(() => {
        if (!controller.signal.aborted) setAnalysing(false)
      })
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [title, description, ready])

  function applySuggestion() {
    if (!classification) return
    setCategory(classification.category)
    setPriority(classification.priority)
    toast('Suggested category and priority applied.', 'success')
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    setSubmitting(true)
    setFormError(null)
    setFieldErrors({})

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          // Omitted entirely when left on auto-detect, so the server classifier decides.
          ...(category ? { category } : {}),
          ...(priority ? { priority } : {}),
          channel: 'WEB',
        }),
      })

      const data: unknown = await res.json().catch(() => null)

      if (!res.ok) {
        const payload = (data ?? {}) as {
          error?: string
          message?: string
          fieldErrors?: Record<string, string[] | string>
          errors?: Record<string, string[] | string>
        }
        const raw = payload.fieldErrors ?? payload.errors
        if (raw) {
          const flat: Record<string, string> = {}
          for (const [k, v] of Object.entries(raw)) {
            const first = Array.isArray(v) ? v[0] : v
            if (typeof first === 'string') flat[k] = first
          }
          setFieldErrors(flat)
        }
        setFormError(
          payload.error ?? payload.message ?? 'Could not create the ticket. Please review the form.'
        )
        setSubmitting(false)
        return
      }

      const created = unwrap<{ id?: string }>(data, ['ticket'])
      const id = created?.id ?? (data as { id?: string } | null)?.id

      toast('Ticket raised successfully.', 'success')

      if (id) router.push(`/tickets/${id}`)
      else router.push('/tickets')
      router.refresh()
    } catch {
      setFormError('Could not reach the server. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      {/* ------------------------------------------------------------ form */}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Describe the issue</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
              >
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{formError}</p>
              </div>
            ) : null}

            <FormField
              label="Title"
              htmlFor="title"
              required
              error={fieldErrors.title}
              hint="A one-line summary, e.g. “VPN disconnects every few minutes from the regional office”."
            >
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                placeholder="Short summary of the problem"
                aria-invalid={fieldErrors.title ? true : undefined}
                aria-describedby={fieldErrors.title ? 'title-error' : 'title-hint'}
                required
              />
            </FormField>

            <FormField
              label="Description"
              htmlFor="description"
              required
              error={fieldErrors.description}
              hint={`${description.trim().length} / 5000 characters. Include error messages, the system involved and when it started.`}
            >
              <Textarea
                id="description"
                name="description"
                rows={9}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
                placeholder="What happened, what you expected, and anything you have already tried…"
                aria-invalid={fieldErrors.description ? true : undefined}
                aria-describedby={
                  fieldErrors.description ? 'description-error' : 'description-hint'
                }
                required
              />
            </FormField>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField label="Category" htmlFor="category" error={fieldErrors.category}>
                <Select
                  id="category"
                  name="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">Auto-detect</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {LABELS.category[c]}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Priority" htmlFor="priority" error={fieldErrors.priority}>
                <Select
                  id="priority"
                  name="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">Auto-detect</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {LABELS.priority[p]}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            {/* Channel is fixed for the web portal. */}
            <input type="hidden" name="channel" value="WEB" />

            <p className="text-xs leading-relaxed text-muted-foreground">
              Leaving category or priority on <strong className="font-medium">Auto-detect</strong>{' '}
              lets the classifier decide, and routes the ticket to the right department
              automatically.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" size="lg" loading={submitting} disabled={!ready || submitting}>
            Submit ticket
          </Button>
          <Link
            href="/tickets"
            className="inline-flex h-12 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Cancel
          </Link>
          {!ready ? (
            <p className="text-xs text-muted-foreground">
              Enter a title and a description to continue.
            </p>
          ) : null}
        </div>
      </form>

      {/* ------------------------------------------------------- right rail */}
      <aside aria-label="Live suggestions" className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles aria-hidden="true" className="h-4 w-4 text-primary" />
          Smart assistance
          {analysing ? (
            <span className="text-xs font-normal text-muted-foreground" role="status">
              analysing…
            </span>
          ) : null}
        </div>

        {!ready ? (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">
                As you type, the system predicts the category and priority, warns about similar
                open tickets, and surfaces knowledge-base articles that might solve the problem
                straight away.
              </p>
            </CardContent>
          </Card>
        ) : null}

        {classification ? (
          <ClassificationCard result={classification} onApply={applySuggestion} />
        ) : null}

        {duplicates.length > 0 ? <DuplicateCard duplicates={duplicates} /> : null}

        {articles.length > 0 ? <KbCard articles={articles} /> : null}
      </aside>
    </div>
  )
}

function ClassificationCard({
  result,
  onApply,
}: {
  result: Classification
  onApply: () => void
}) {
  const pct = Math.round((result.confidence ?? 0) * 100)

  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Wand2 aria-hidden="true" className="h-4 w-4 text-primary" />
          Predicted classification
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 pt-2">
        <p className="text-sm text-foreground">
          <span className="font-medium">Suggested:</span>{' '}
          {LABELS.category[result.category] ?? result.category} ·{' '}
          {LABELS.priority[result.priority] ?? result.priority} priority ({pct}% confidence)
        </p>

        {result.matchedTerms?.length ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Matched terms</p>
            <div className="flex flex-wrap gap-1.5">
              {result.matchedTerms.slice(0, 8).map((term) => (
                <Badge key={term} variant="secondary" className="font-mono text-[11px]">
                  {term}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {!result.autoClassified ? (
          <p className="text-xs text-muted-foreground">
            Confidence is below the automatic-classification threshold, so a support agent will
            triage this manually.
          </p>
        ) : null}

        <Button type="button" variant="outline" size="sm" onClick={onApply} className="w-fit">
          Apply suggestion
        </Button>
      </CardContent>
    </Card>
  )
}

function DuplicateCard({ duplicates }: { duplicates: Duplicate[] }) {
  return (
    <Card
      className={cn(
        'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/40'
      )}
    >
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle aria-hidden="true" className="h-4 w-4" />
          Possibly already reported
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 pt-2">
        <p className="text-xs text-amber-900/90 dark:text-amber-200/90">
          These open tickets look similar. You can still submit — this is only a heads-up.
        </p>
        <ul className="flex flex-col gap-2">
          {duplicates.map((d) => (
            <li key={d.ticketId}>
              <Link
                href={`/tickets/${d.ticketId}`}
                className="flex flex-col gap-1 rounded-md border border-amber-200 bg-card px-3 py-2 transition-colors hover:border-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-amber-800"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium text-primary">
                    {d.ticketNumber}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {Math.round((d.similarity ?? 0) * 100)}% similar
                  </span>
                </span>
                <span className="line-clamp-2 text-sm text-foreground">{d.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function KbCard({ articles }: { articles: KbSuggestion[] }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Lightbulb aria-hidden="true" className="h-4 w-4 text-primary" />
          Before you submit
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-4 pt-2">
        <p className="text-xs text-muted-foreground">
          These articles might resolve the issue immediately.
        </p>
        <ul className="flex flex-col gap-2">
          {articles.map((a) => (
            <li key={a.id ?? a.slug}>
              <a
                href={`/kb/${a.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 rounded-md border border-border px-3 py-2 transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BookOpen aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 text-sm text-foreground">{a.title}</span>
                <ExternalLink
                  aria-hidden="true"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
