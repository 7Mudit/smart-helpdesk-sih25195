'use client'

import * as React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label, Select } from '@/components/ui/input'
import {
  CATEGORIES,
  DEPARTMENTS,
  LABELS,
  PRIORITIES,
  STATUSES,
} from '@/lib/constants'

export interface AssigneeOption {
  id: string
  name: string
}

export interface TicketFiltersProps {
  /** Empty for employees, who have no assignee filter. */
  assignees?: AssigneeOption[]
  showAssignee?: boolean
}

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'priority', label: 'Highest priority' },
  { value: 'due', label: 'SLA due soonest' },
] as const

export function TicketFilters({ assignees = [], showAssignee = false }: TicketFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const [search, setSearch] = React.useState(params.get('search') ?? '')

  // Keep the box in step when the URL changes from elsewhere (global search).
  React.useEffect(() => {
    setSearch(params.get('search') ?? '')
  }, [params])

  const push = React.useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString())
      mutate(next)
      // Any filter change resets to the first page.
      next.delete('page')
      const qs = next.toString()
      router.push(qs ? `${pathname}?${qs}` : pathname)
    },
    [params, pathname, router]
  )

  function setParam(key: string, value: string) {
    push((next) => {
      if (value) next.set(key, value)
      else next.delete(key)
    })
  }

  function onSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setParam('search', search.trim())
  }

  const activeCount = ['status', 'priority', 'category', 'department', 'assignee', 'search'].filter(
    (k) => params.get(k)
  ).length

  return (
    <section
      aria-label="Ticket filters"
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <form onSubmit={onSearchSubmit} role="search" className="min-w-[14rem] flex-1">
          <Label htmlFor="ticket-search" className="mb-2 block">
            Search
          </Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="ticket-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ticket number, title or description…"
              className="h-10 w-full rounded-md border border-input bg-card pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            />
          </div>
        </form>

        <Button type="button" variant="outline" onClick={() => setParam('search', search.trim())}>
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
          Apply
        </Button>

        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(pathname)}
            aria-label={`Clear all ${activeCount} filters`}
          >
            <X aria-hidden="true" className="h-4 w-4" />
            Clear ({activeCount})
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <FilterSelect
          id="filter-status"
          label="Status"
          value={params.get('status') ?? ''}
          onChange={(v) => setParam('status', v)}
          allLabel="All statuses"
          options={STATUSES.map((s) => ({ value: s, label: LABELS.status[s] }))}
        />

        <FilterSelect
          id="filter-priority"
          label="Priority"
          value={params.get('priority') ?? ''}
          onChange={(v) => setParam('priority', v)}
          allLabel="All priorities"
          options={PRIORITIES.map((p) => ({ value: p, label: LABELS.priority[p] }))}
        />

        <FilterSelect
          id="filter-category"
          label="Category"
          value={params.get('category') ?? ''}
          onChange={(v) => setParam('category', v)}
          allLabel="All categories"
          options={CATEGORIES.map((c) => ({ value: c, label: LABELS.category[c] }))}
        />

        <FilterSelect
          id="filter-department"
          label="Department"
          value={params.get('department') ?? ''}
          onChange={(v) => setParam('department', v)}
          allLabel="All departments"
          options={DEPARTMENTS.map((d) => ({ value: d, label: LABELS.department[d] }))}
        />

        {showAssignee ? (
          <FilterSelect
            id="filter-assignee"
            label="Assignee"
            value={params.get('assignee') ?? ''}
            onChange={(v) => setParam('assignee', v)}
            allLabel="Anyone"
            options={[
              { value: 'unassigned', label: 'Unassigned' },
              ...assignees.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        ) : null}

        <FilterSelect
          id="filter-sort"
          label="Sort by"
          value={params.get('sort') ?? 'newest'}
          onChange={(v) => setParam('sort', v === 'newest' ? '' : v)}
          options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
        />
      </div>
    </section>
  )
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  allLabel?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {allLabel ? <option value="">{allLabel}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  )
}
