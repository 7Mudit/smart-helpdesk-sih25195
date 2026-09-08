'use client'

import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts'
import { CHART_COLORS, ChartFrame, ChartLoading, useChartTheme, useMounted } from './chart-kit'

export interface SlaGaugeProps {
  met: number
  breached: number
}

const HEIGHT = 220

/** Compliance bands — the colour reinforces the number, never replaces it. */
function band(pct: number): { label: string; tone: string } {
  if (pct >= 95) return { label: 'Excellent', tone: 'text-emerald-600 dark:text-emerald-400' }
  if (pct >= 85) return { label: 'On target', tone: 'text-emerald-600 dark:text-emerald-400' }
  if (pct >= 70) return { label: 'Needs attention', tone: 'text-amber-600 dark:text-amber-400' }
  return { label: 'Critical', tone: 'text-red-600 dark:text-red-400' }
}

export function SlaGauge({ met, breached }: SlaGaugeProps) {
  const mounted = useMounted()
  const theme = useChartTheme()

  const total = met + breached
  const pct = total > 0 ? Math.round((met / total) * 1000) / 10 : 100
  const { label, tone } = band(pct)

  const fill = theme.pick(pct >= 85 ? CHART_COLORS.met : pct >= 70 ? CHART_COLORS.open : CHART_COLORS.breached)
  const track = theme.isDark ? '#334155' : '#e2e8f0'

  const summary =
    `SLA compliance is ${pct} percent — rated ${label}. ` +
    `${met} of ${total} tickets met their SLA target; ${breached} breached.`

  return (
    <ChartFrame
      title="SLA compliance"
      description="Share of tickets resolved within target"
      summary={summary}
      height={HEIGHT}
      footer={
        <dl className="grid grid-cols-2 gap-3 px-6 pb-6 pt-0">
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
            <dt className="text-xs font-medium text-muted-foreground">Met</dt>
            <dd className="text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {met}
            </dd>
          </div>
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
            <dt className="text-xs font-medium text-muted-foreground">Breached</dt>
            <dd className="text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">
              {breached}
            </dd>
          </div>
        </dl>
      }
    >
      {!mounted ? (
        <ChartLoading height={HEIGHT} />
      ) : (
        <div className="relative h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              data={[{ name: 'Compliance', value: pct, fill }]}
              innerRadius="68%"
              outerRadius="100%"
              startAngle={210}
              endAngle={-30}
              barSize={18}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
              <RadialBar
                background={{ fill: track }}
                dataKey="value"
                cornerRadius={9}
                isAnimationActive={false}
              />
            </RadialBarChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-4">
            <span className="text-3xl font-semibold tabular-nums text-foreground">{pct}%</span>
            <span className={`text-xs font-medium ${tone}`}>{label}</span>
          </div>
        </div>
      )}
    </ChartFrame>
  )
}
