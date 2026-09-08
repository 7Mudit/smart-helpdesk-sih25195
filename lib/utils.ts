import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Priority, Status, Category } from './constants'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Semantic colour maps. Every one of these pairs colour with a text label in
// the UI — colour is never the sole carrier of meaning (WCAG 1.4.1).

export const priorityStyles: Record<Priority, string> = {
  LOW: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  MEDIUM: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:ring-sky-800',
  HIGH: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-800',
  CRITICAL: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950 dark:text-red-300 dark:ring-red-800',
}

export const statusStyles: Record<Status, string> = {
  OPEN: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-800',
  IN_PROGRESS: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:ring-violet-800',
  ON_HOLD: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-800',
  RESOLVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-800',
  CLOSED: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700',
  REOPENED: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-950 dark:text-fuchsia-300 dark:ring-fuchsia-800',
}

export const categoryIcons: Record<Category, string> = {
  HARDWARE: 'HardDrive',
  SOFTWARE: 'AppWindow',
  NETWORK: 'Wifi',
  ACCESS: 'KeyRound',
  EMAIL: 'Mail',
  SAP_ERP: 'Database',
  SECURITY: 'ShieldAlert',
  OTHER: 'CircleHelp',
}

/** "2 hours ago", "in 45 minutes" — compact relative time for timelines. */
export function relativeTime(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = d.getTime() - now.getTime()
  const future = diffMs > 0
  const abs = Math.abs(diffMs)

  const mins = Math.round(abs / 60000)
  const hours = Math.round(abs / 3600000)
  const days = Math.round(abs / 86400000)

  let value: string
  if (abs < 45000) value = 'just now'
  else if (mins < 60) value = `${mins} minute${mins === 1 ? '' : 's'}`
  else if (hours < 24) value = `${hours} hour${hours === 1 ? '' : 's'}`
  else if (days < 30) value = `${days} day${days === 1 ? '' : 's'}`
  else value = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  if (value === 'just now' || value.includes(',') || /\d{4}/.test(value)) return value
  return future ? `in ${value}` : `${value} ago`
}

/** "4h 20m" / "35m" / "2d 3h" — for SLA countdowns. */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  if (h < 24) return rem ? `${h}h ${rem}m` : `${h}h`
  const d = Math.floor(h / 24)
  const remH = h % 24
  return remH ? `${d}d ${remH}h` : `${d}d`
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** Deterministic avatar tint from a user id — stable across renders and machines. */
export function avatarColor(seed: string): string {
  const palette = [
    'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
    'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
    'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200',
    'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-200',
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]!
}
