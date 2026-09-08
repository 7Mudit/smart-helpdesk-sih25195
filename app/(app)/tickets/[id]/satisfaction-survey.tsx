'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label, Textarea } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

const RATING_LABELS: Record<number, string> = {
  1: 'Very dissatisfied',
  2: 'Dissatisfied',
  3: 'Neutral',
  4: 'Satisfied',
  5: 'Very satisfied',
}

export function SatisfactionSurvey({ ticketId }: { ticketId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [rating, setRating] = React.useState(0)
  const [hover, setHover] = React.useState(0)
  const [comment, setComment] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (rating < 1 || submitting) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/tickets/${ticketId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          ...(comment.trim() ? { comment: comment.trim() } : {}),
        }),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null
        setError(payload?.error ?? payload?.message ?? 'Could not submit your rating.')
        setSubmitting(false)
        return
      }

      toast('Thank you for your feedback.', 'success')
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
      setSubmitting(false)
    }
  }

  const shown = hover || rating

  return (
    <Card>
      <CardHeader>
        <CardTitle>How was the resolution?</CardTitle>
        <CardDescription>
          Your rating helps the IT service desk measure and improve support quality.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-foreground">
              Satisfaction rating
              <span aria-hidden="true" className="ml-0.5 text-destructive">
                *
              </span>
            </legend>

            <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHover(value)}
                  onFocus={() => setHover(value)}
                  onBlur={() => setHover(0)}
                  aria-pressed={rating === value}
                  aria-label={`${value} of 5 — ${RATING_LABELS[value]}`}
                  className="rounded-md p-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  <Star
                    aria-hidden="true"
                    className={cn(
                      'h-7 w-7 transition-colors',
                      value <= shown
                        ? 'fill-amber-400 text-amber-500 dark:fill-amber-400 dark:text-amber-400'
                        : 'text-muted-foreground'
                    )}
                  />
                </button>
              ))}

              <span className="ml-2 text-sm text-muted-foreground" aria-live="polite">
                {shown ? RATING_LABELS[shown] : 'Select a rating'}
              </span>
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="satisfaction-comment">Comments (optional)</Label>
            <Textarea
              id="satisfaction-comment"
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Anything the team should know about how this was handled?"
            />
          </div>

          {error ? (
            <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <Button type="submit" loading={submitting} disabled={rating < 1 || submitting} className="w-fit">
            Submit feedback
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
