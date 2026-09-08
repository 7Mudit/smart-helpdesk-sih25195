'use client'

import {
  Bar,
  BarChart,
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

export interface AgentLoad {
  id: string
  name: string
  open: number
  resolved: number
}

export interface AgentWorkloadChartProps {
  data: AgentLoad[]
}

/** Grows with the number of agents so bars keep a comfortable height. */
function heightFor(count: number): number {
  return Math.max(200, Math.min(420, 56 + count * 34))
}

export function AgentWorkloadChart({ data }: AgentWorkloadChartProps) {
  const mounted = useMounted()
  const theme = useChartTheme()

  const height = heightFor(data.length)
  const busiest = data[0]
  const totalOpen = data.reduce((s, d) => s + d.open, 0)

  const summary =
    data.length === 0
      ? 'No agents with assigned tickets.'
      : `Workload across ${data.length} agents, ${totalOpen} open tickets in total. ` +
        `Busiest is ${busiest?.name} with ${busiest?.open} open and ${busiest?.resolved} resolved. ` +
        `Full list: ` +
        data.map((d) => `${d.name} ${d.open} open ${d.resolved} resolved`).join('; ') +
        '.'

  const openColor = theme.pick(CHART_COLORS.open)
  const resolvedColor = theme.pick(CHART_COLORS.resolved)

  return (
    <ChartFrame
      title="Agent workload"
      description="Open vs resolved per agent, busiest first"
      summary={summary}
      height={height}
    >
      {!mounted ? (
        <ChartLoading height={height} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 20, bottom: 0, left: 8 }}
            barCategoryGap="22%"
          >
            <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={axisTick(theme)}
              tickLine={false}
              axisLine={{ stroke: theme.grid }}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={axisTick(theme)}
              tickLine={false}
              axisLine={false}
              width={116}
            />
            <Tooltip {...tooltipProps(theme)} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, color: theme.axis, paddingTop: 4 }}
            />
            <Bar
              dataKey="open"
              name="Open"
              fill={openColor}
              radius={[0, 4, 4, 0]}
              maxBarSize={14}
              isAnimationActive={false}
            />
            <Bar
              dataKey="resolved"
              name="Resolved"
              fill={resolvedColor}
              radius={[0, 4, 4, 0]}
              maxBarSize={14}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  )
}
