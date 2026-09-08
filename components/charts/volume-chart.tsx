'use client'

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  CHART_COLORS,
  ChartFrame,
  ChartLoading,
  axisTick,
  tooltipProps,
  useChartTheme,
  useMounted,
} from './chart-kit'

export interface VolumePoint {
  /** ISO date, YYYY-MM-DD. */
  date: string
  /** Short display label, e.g. "12 Aug". */
  label: string
  created: number
  resolved: number
}

export interface VolumeChartProps {
  data: VolumePoint[]
}

const HEIGHT = 280

export function VolumeChart({ data }: VolumeChartProps) {
  const mounted = useMounted()
  const theme = useChartTheme()

  const totalCreated = data.reduce((s, d) => s + d.created, 0)
  const totalResolved = data.reduce((s, d) => s + d.resolved, 0)
  const peak = data.reduce(
    (best, d) => (d.created > best.created ? d : best),
    data[0] ?? { label: '—', created: 0, resolved: 0, date: '' }
  )

  const summary =
    `Ticket volume over the last ${data.length} days: ${totalCreated} raised and ` +
    `${totalResolved} resolved. Busiest day was ${peak.label} with ${peak.created} tickets raised.`

  const created = theme.pick(CHART_COLORS.created)
  const resolved = theme.pick(CHART_COLORS.resolved)

  return (
    <ChartFrame
      title="Ticket volume"
      description="Raised vs resolved, last 30 days"
      summary={summary}
      height={HEIGHT}
    >
      {!mounted ? (
        <ChartLoading height={HEIGHT} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
            <defs>
              <linearGradient id="volCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={created} stopOpacity={0.32} />
                <stop offset="100%" stopColor={created} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="volResolved" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={resolved} stopOpacity={0.28} />
                <stop offset="100%" stopColor={resolved} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTick(theme)}
              tickLine={false}
              axisLine={{ stroke: theme.grid }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={axisTick(theme)}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={40}
            />
            <Tooltip {...tooltipProps(theme)} cursor={{ stroke: theme.grid, strokeWidth: 1 }} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: theme.axis, paddingTop: 8 }}
            />
            <Area
              type="monotone"
              dataKey="created"
              name="Raised"
              stroke={created}
              strokeWidth={2}
              fill="url(#volCreated)"
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="resolved"
              name="Resolved"
              stroke={resolved}
              strokeWidth={2}
              fill="url(#volResolved)"
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  )
}
