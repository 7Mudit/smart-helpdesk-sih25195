'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Lock, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

export interface ReplyComposerProps {
  ticketId: string
  /** AGENT / ADMIN only — gates the internal-note toggle. */
  canPostInternal: boolean
}

export function ReplyComposer({ ticketId, canPostInternal }: ReplyComposerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [body, setBody] = React.useState('')
  const [isInternal, setIsInternal] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = body.trim()
    if (!text || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text, isInternal: canPostInternal && isInternal }),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null
        setError(payload?.error ?? payload?.message ?? 'Could not post your reply.')
        setSubmitting(false)
        return
      }

      setBody('')
      setIsInternal(false)
      toast(isInternal ? 'Internal note added.' : 'Reply posted.', 'success')
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors',
        isInternal
          ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30'
          : 'border-border'
      )}
    >
      <Label htmlFor="reply-body">{isInternal ? 'Internal note' : 'Add a reply'}</Label>

      <Textarea
        id="reply-body"
        name="body"
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={5000}
        placeholder={
          isInternal
            ? 'Visible to agents and administrators only…'
            : 'Write your reply to this ticket…'
        }
        aria-describedby={error ? 'reply-error' : undefined}
        aria-invalid={error ? true : undefined}
      />

      {error ? (
        <p id="reply-error" role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {canPostInternal ? (
          <div className="flex items-center gap-2">
            <input
              id="reply-internal"
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="h-4 w-4 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            />
            <Label htmlFor="reply-internal" className="flex items-center gap-1.5 font-normal">
              <Lock aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
              Internal note — hidden from the requester
            </Label>
          </div>
        ) : (
          <span />
        )}

        <Button type="submit" loading={submitting} disabled={!body.trim() || submitting}>
          <Send aria-hidden="true" className="h-4 w-4" />
          {isInternal ? 'Add note' : 'Post reply'}
        </Button>
      </div>
    </form>
  )
}
