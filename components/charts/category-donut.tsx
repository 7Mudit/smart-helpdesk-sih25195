'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { LABELS, type Category } from '@/lib/constants'
import {
  CATEGORY_COLORS,
  ChartFrame,
  ChartLegend,
  ChartLoading,
  tooltipProps,
  useChartTheme,
  useMounted,
} from './chart-kit'

export interface CategorySlice {
  category: Category
  count: number
}

export interface CategoryDonutProps {
  data: CategorySlice[]
}

const HEIGHT = 220

export function CategoryDonut({ data }: CategoryDonutProps) {
  const mounted = useMounted()
  const theme = useChartTheme()

  const total = data.reduce((s, d) => s + d.count, 0)
  const rows = data.map((d, i) => ({
    ...d,
    label: LABELS.category[d.category],
    color: theme.pick(CATEGORY_COLORS[i % CATEGORY_COLORS.length]!),
    pct: total > 0 ? Math.round((d.count / total) * 100) : 0,
  }))

  const top = rows[0]
  const summary =
    total === 0
      ? 'No tickets to break down by category.'
      : `${total} tickets by category. Largest is ${top?.label} with ${top?.count} tickets ` +
        `(${top?.pct} percent). Full breakdown: ` +
        rows.map((r) => `${r.label} ${r.count}`).join(', ') +
        '.'

  return (
    <ChartFrame
      title="Category breakdown"
      description="All tickets by issue type"
      summary={summary}
      height={HEIGHT}
      footer={
        <ChartLegend
          entries={rows.map((r) => ({
            label: r.label,
            value: r.count,
            color: r.color,
            hint: `${r.pct}%`,
          }))}
        />
      }
    >
      {!mounted ? (
        <ChartLoading height={HEIGHT} />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {rows.map((r) => (
                <Cell key={r.category} fill={r.color} />
              ))}
              {/* centre total */}
            </Pie>
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="central"
              fill={theme.tooltipText}
            >
              <tspan x="50%" dy="-0.35em" fontSize="22" fontWeight="600">
                {total}
              </tspan>
              <tspan x="50%" dy="1.6em" fontSize="11" fill={theme.axis}>
                tickets
              </tspan>
            </text>
            <Tooltip
              {...tooltipProps(theme)}
              formatter={(value: number, name: string) => [`${value} tickets`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  )
}
