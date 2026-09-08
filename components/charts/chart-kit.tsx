'use client'

import * as React from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Recharts measures the DOM, so a server render and the first client render
 * disagree and React reports a hydration mismatch. Every chart in this folder
 * therefore renders a Skeleton until after mount.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return mounted
}

/**
 * Chart palettes. These are the only hardcoded hex values in the app: SVG fills
 * cannot use Tailwind classes, and recharts needs a concrete colour string.
 * Every entry has an explicit light and dark value so charts stay legible in
 * both themes.
 */
export interface ThemedColor {
  light: string
  dark: string
}

export const CHART_COLORS = {
  created: { light: '#1d4ed8', dark: '#60a5fa' },
  resolved: { light: '#059669', dark: '#34d399' },
  open: { light: '#d97706', dark: '#fbbf24' },
  breached: { light: '#dc2626', dark: '#f87171' },
  met: { light: '#059669', dark: '#34d399' },
  neutral: { light: '#94a3b8', dark: '#64748b' },
} satisfies Record<string, ThemedColor>

/** Priority colours mirror the semantics of `priorityStyles` in lib/utils. */
export const PRIORITY_COLORS: Record<string, ThemedColor> = {
  LOW: { light: '#64748b', dark: '#94a3b8' },
  MEDIUM: { light: '#0284c7', dark: '#38bdf8' },
  HIGH: { light: '#d97706', dark: '#fbbf24' },
  CRITICAL: { light: '#dc2626', dark: '#f87171' },
}

/** Eight categorical hues, ordered to keep neighbouring slices distinguishable. */
export const CATEGORY_COLORS: ThemedColor[] = [
  { light: '#1d4ed8', dark: '#60a5fa' },
  { light: '#0d9488', dark: '#2dd4bf' },
  { light: '#7c3aed', dark: '#a78bfa' },
  { light: '#d97706', dark: '#fbbf24' },
  { light: '#db2777', dark: '#f472b6' },
  { light: '#059669', dark: '#34d399' },
  { light: '#dc2626', dark: '#f87171' },
  { light: '#64748b', dark: '#94a3b8' },
]

/** Foreground/grid colours resolved per theme so axes stay readable. */
export interface ChartTheme {
  isDark: boolean
  axis: string
  grid: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  pick: (c: ThemedColor) => string
}

const LIGHT_THEME: Omit<ChartTheme, 'pick' | 'isDark'> = {
  axis: '#64748b',
  grid: '#e2e8f0',
  tooltipBg: '#ffffff',
  tooltipBorder: '#cbd5e1',
  tooltipText: '#0f172a',
}

const DARK_THEME: Omit<ChartTheme, 'pick' | 'isDark'> = {
  axis: '#94a3b8',
  grid: '#334155',
  tooltipBg: '#1a2332',
  tooltipBorder: '#3f4d63',
  tooltipText: '#f1f5f9',
}

/**
 * Tracks the `dark` class on <html>, which the no-flash script and the
 * ThemeToggle both drive. A MutationObserver keeps charts in sync when the
 * user flips the toggle without a reload.
 */
export function useChartTheme(): ChartTheme {
  const [isDark, setIsDark] = React.useState(false)

  React.useEffect(() => {
    const root = document.documentElement
    const sync = () => setIsDark(root.classList.contains('dark'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return React.useMemo<ChartTheme>(() => {
    const base = isDark ? DARK_THEME : LIGHT_THEME
    return {
      isDark,
      ...base,
      pick: (c: ThemedColor) => (isDark ? c.dark : c.light),
    }
  }, [isDark])
}

/** Shared recharts <Tooltip> styling, token-matched in both themes. */
export function tooltipProps(theme: ChartTheme) {
  return {
    contentStyle: {
      backgroundColor: theme.tooltipBg,
      border: `1px solid ${theme.tooltipBorder}`,
      borderRadius: '0.5rem',
      fontSize: '12px',
      padding: '8px 12px',
      boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
    },
    labelStyle: { color: theme.tooltipText, fontWeight: 600, marginBottom: 4 },
    itemStyle: { color: theme.tooltipText, padding: 0 },
    cursor: { fill: theme.grid, fillOpacity: theme.isDark ? 0.25 : 0.5 },
  } as const
}

export const axisTick = (theme: ChartTheme) =>
  ({ fill: theme.axis, fontSize: 11 }) as const

/**
 * Chart frame: heading, an sr-only text alternative (WCAG 1.1.1 — every chart
 * must be readable without seeing it), and a fixed-height plot area.
 */
export interface ChartFrameProps {
  title: string
  description?: string
  /** Text alternative read by screen readers in place of the SVG. */
  summary: string
  height?: number
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
  /** Rendered below the plot area — legends, captions. Not aria-hidden. */
  footer?: React.ReactNode
}

export function ChartFrame({
  title,
  description,
  summary,
  height = 260,
  action,
  className,
  children,
  footer,
}: ChartFrameProps) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card text-card-foreground',
        className
      )}
      aria-label={title}
    >
      <header className="flex items-start justify-between gap-4 p-6 pb-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold leading-6 tracking-tight">{title}</h3>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>

      <p className="sr-only">{summary}</p>

      <div className="px-2 pb-2 pt-2" style={{ height }} aria-hidden="true">
        {children}
      </div>

      {footer ? <div className="mt-auto">{footer}</div> : <div className="pb-4" />}
    </section>
  )
}

/** Placeholder with the same footprint as the chart, shown until mount. */
export function ChartLoading({ height = 260 }: { height?: number }) {
  return (
    <div className="flex h-full w-full items-end gap-2 px-4 pb-2" style={{ height }}>
      {[45, 70, 55, 85, 60, 95, 72, 50].map((h, i) => (
        <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}

/** Compact legend used beneath donut/bar charts. Pairs colour with a text label. */
export interface LegendEntry {
  label: string
  value: number
  color: string
  hint?: string
}

export function ChartLegend({ entries }: { entries: LegendEntry[] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-2 px-6 pb-6 pt-0 text-sm">
      {entries.map((e) => (
        <li key={e.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: e.color }}
          />
          <span className="min-w-0 flex-1 truncate text-muted-foreground">{e.label}</span>
          <span className="shrink-0 font-medium tabular-nums text-foreground">{e.value}</span>
          {e.hint ? (
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{e.hint}</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
