import * as React from 'react'
import { BookOpenCheck, Gauge, Route, Sparkles, Wand2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export interface AutomationImpactProps {
  totalTickets: number
  autoClassified: number
  autoRouted: number
  /** Mean classifier confidence over auto-classified tickets, 0–1. */
  meanConfidence: number
  /** Sum of KbArticle.deflectionCount. */
  kbDeflections: number
}

interface Metric {
  label: string
  pct: number
  detail: string
  icon: React.ReactNode
}

function pctOf(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0
}

export function AutomationImpact({
  totalTickets,
  autoClassified,
  autoRouted,
  meanConfidence,
  kbDeflections,
}: AutomationImpactProps) {
  const classifiedPct = pctOf(autoClassified, totalTickets)
  const routedPct = pctOf(autoRouted, totalTickets)
  const confidencePct = Math.round(meanConfidence * 1000) / 10

  // The headline: a ticket is "hands-free" when the machine both classified
  // and routed it, so a coordinator never had to touch it.
  const triagedPct = pctOf(Math.min(autoClassified, autoRouted), totalTickets)

  const metrics: Metric[] = [
    {
      label: 'Auto-classified',
      pct: classifiedPct,
      detail: `${autoClassified} of ${totalTickets} tickets had category and priority set by the classifier`,
      icon: <Wand2 aria-hidden="true" className="h-4 w-4" />,
    },
    {
      label: 'Auto-routed',
      pct: routedPct,
      detail: `${autoRouted} tickets assigned to a department or agent by rule match or load balancing`,
      icon: <Route aria-hidden="true" className="h-4 w-4" />,
    },
    {
      label: 'Mean classifier confidence',
      pct: confidencePct,
      detail: `Below the ${35}% floor the classifier defers to a human instead of guessing`,
      icon: <Gauge aria-hidden="true" className="h-4 w-4" />,
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-2 border-b border-border bg-primary/5 pb-5 dark:bg-primary/10">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20"
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <CardTitle>Automation impact</CardTitle>
        </div>
        <CardDescription>
          What the system did without a human in the loop.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6 pt-6">
        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <p className="text-3xl font-semibold leading-none tabular-nums tracking-tight text-foreground">
            {triagedPct}%
          </p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">
            of tickets triaged without human intervention — classified{' '}
            <span className="font-medium text-foreground">and</span> routed automatically at the
            moment they were raised.
          </p>
        </div>

        <dl className="flex flex-col gap-5">
          {metrics.map((m) => (
            <div key={m.label} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span aria-hidden="true" className="text-muted-foreground">
                    {m.icon}
                  </span>
                  {m.label}
                </dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">{m.pct}%</dd>
              </div>
              <Progress value={m.pct} label={`${m.label}: ${m.pct} percent`} />
              <p className="text-xs leading-4 text-muted-foreground">{m.detail}</p>
            </div>
          ))}
        </dl>

        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/50">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
          >
            <BookOpenCheck className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-0.5">
            <p className="text-xl font-semibold leading-none tabular-nums text-emerald-900 dark:text-emerald-100">
              {kbDeflections}
            </p>
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              tickets deflected by the knowledge base
            </p>
            <p className="text-xs leading-4 text-emerald-800/80 dark:text-emerald-200/80">
              Drafts abandoned after the requester opened a suggested article — issues solved
              before a ticket ever reached the queue.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
