'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'

export interface VoteButtonsProps {
  slug: string
  helpfulCount: number
  notHelpfulCount: number
}

export function VoteButtons({ slug, helpfulCount, notHelpfulCount }: VoteButtonsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [voted, setVoted] = React.useState<'helpful' | 'not_helpful' | null>(null)
  const [pending, setPending] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function vote(kind: 'helpful' | 'not_helpful') {
    if (voted || pending) return
    setPending(kind)
    setError(null)

    try {
      const res = await fetch(`/api/kb/${slug}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: kind, helpful: kind === 'helpful' }),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null
        setError(payload?.error ?? payload?.message ?? 'Could not record your feedback.')
        setPending(null)
        return
      }

      setVoted(kind)
      toast('Thanks — your feedback was recorded.', 'success')
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
    } finally {
      setPending(null)
    }
  }

  return (
    <section
      aria-labelledby="vote-heading"
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5"
    >
      <h2 id="vote-heading" className="text-sm font-semibold text-foreground">
        Was this article helpful?
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={voted === 'helpful' ? 'default' : 'outline'}
          onClick={() => vote('helpful')}
          loading={pending === 'helpful'}
          disabled={voted !== null || pending !== null}
          aria-pressed={voted === 'helpful'}
        >
          <ThumbsUp aria-hidden="true" className="h-4 w-4" />
          Yes ({helpfulCount})
        </Button>

        <Button
          variant={voted === 'not_helpful' ? 'default' : 'outline'}
          onClick={() => vote('not_helpful')}
          loading={pending === 'not_helpful'}
          disabled={voted !== null || pending !== null}
          aria-pressed={voted === 'not_helpful'}
        >
          <ThumbsDown aria-hidden="true" className="h-4 w-4" />
          No ({notHelpfulCount})
        </Button>

        {voted ? (
          <p className="text-sm text-muted-foreground" role="status">
            {voted === 'helpful'
              ? 'Glad it helped.'
              : 'Thanks — consider raising a ticket so an agent can help.'}
          </p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  )
}
