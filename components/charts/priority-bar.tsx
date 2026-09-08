'use client'

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LABELS, type Priority } from '@/lib/constants'
import {
  ChartFrame,
  ChartLoading,
  PRIORITY_COLORS,
  axisTick,
  tooltipProps,
  useChartTheme,
  useMounted,
} from './chart-kit'

export interface PriorityBucket {
  priority: Priority
  count: number
}

export interface PriorityBarProps {
  data: PriorityBucket[]
}

const HEIGHT = 220

export function PriorityBar({ data }: PriorityBarProps) {
  const mounted = useMounted()
  const theme = useChartTheme()

  const total = data.reduce((s, d) => s + d.count, 0)
  const rows = data.map((d) => ({
    ...d,
    label: LABELS.priority[d.priority],
    color: theme.pick(PRIORITY_COLORS[d.priority]!),
  }))

  const critical = rows.find((r) => r.priority === 'CRITICAL')?.count ?? 0
  const summary =
    `Priority distribution across ${total} tickets: ` +
    rows.map((r) => `${r.label} ${r.count}`).join(', ') +
    `. ${critical} are critical.`

  return (
    <ChartFrame
      title="Priority distribution"
      description="Open workload by severity"
      summary={summary}
      height={HEIGHT}
    >
      {!mounted ? (
        <ChartLoading height={HEIGHT} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTick(theme)}
              tickLine={false}
              axisLine={{ stroke: theme.grid }}
            />
            <YAxis
              tick={axisTick(theme)}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={40}
            />
            <Tooltip
              {...tooltipProps(theme)}
              formatter={(value: number) => [`${value} tickets`, 'Count']}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={64} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.priority} fill={r.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  )
}
