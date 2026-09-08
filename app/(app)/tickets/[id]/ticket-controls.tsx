'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Label, Select } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import {
  DEPARTMENTS,
  LABELS,
  PRIORITIES,
  STATUSES,
  type Department,
  type Priority,
  type Status,
} from '@/lib/constants'

export interface AssignableUser {
  id: string
  name: string
}

export interface TicketControlsProps {
  ticketId: string
  status: Status
  priority: Priority
  department: Department
  assignedToId: string | null
  agents: AssignableUser[]
}

export function TicketControls({
  ticketId,
  status,
  priority,
  department,
  assignedToId,
  agents,
}: TicketControlsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Optimistic local state so the select does not snap back before refresh.
  const [local, setLocal] = React.useState({
    status,
    priority,
    department,
    assignedToId: assignedToId ?? '',
  })

  React.useEffect(() => {
    setLocal({ status, priority, department, assignedToId: assignedToId ?? '' })
  }, [status, priority, department, assignedToId])

  async function patch(field: string, value: string, label: string) {
    setPending(field)
    setError(null)

    const body: Record<string, string | null> =
      field === 'assignedToId' ? { assignedToId: value === '' ? null : value } : { [field]: value }

    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; message?: string }
          | null
        setError(payload?.error ?? payload?.message ?? `Could not update the ${label}.`)
        // Roll back to the server-known value.
        setLocal({ status, priority, department, assignedToId: assignedToId ?? '' })
        setPending(null)
        return
      }

      toast(`${label} updated.`, 'success')
      router.refresh()
    } catch {
      setError('Could not reach the server. Please try again.')
      setLocal({ status, priority, department, assignedToId: assignedToId ?? '' })
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <Field id="control-status" label="Status" busy={pending === 'status'}>
        <Select
          id="control-status"
          value={local.status}
          disabled={pending !== null}
          onChange={(e) => {
            const v = e.target.value as Status
            setLocal((p) => ({ ...p, status: v }))
            void patch('status', v, 'Status')
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {LABELS.status[s]}
            </option>
          ))}
        </Select>
      </Field>

      <Field id="control-priority" label="Priority" busy={pending === 'priority'}>
        <Select
          id="control-priority"
          value={local.priority}
          disabled={pending !== null}
          onChange={(e) => {
            const v = e.target.value as Priority
            setLocal((p) => ({ ...p, priority: v }))
            void patch('priority', v, 'Priority')
          }}
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {LABELS.priority[p]}
            </option>
          ))}
        </Select>
      </Field>

      <Field id="control-assignee" label="Assignee" busy={pending === 'assignedToId'}>
        <Select
          id="control-assignee"
          value={local.assignedToId}
          disabled={pending !== null}
          onChange={(e) => {
            const v = e.target.value
            setLocal((p) => ({ ...p, assignedToId: v }))
            void patch('assignedToId', v, 'Assignee')
          }}
        >
          <option value="">Unassigned</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field id="control-department" label="Department" busy={pending === 'department'}>
        <Select
          id="control-department"
          value={local.department}
          disabled={pending !== null}
          onChange={(e) => {
            const v = e.target.value as Department
            setLocal((p) => ({ ...p, department: v }))
            void patch('department', v, 'Department')
          }}
        >
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {LABELS.department[d]}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}

function Field({
  id,
  label,
  busy,
  children,
}: {
  id: string
  label: string
  busy: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="flex items-center gap-2">
        {label}
        {busy ? (
          <span role="status" className="text-xs font-normal text-muted-foreground">
            saving…
          </span>
        ) : null}
      </Label>
      {children}
    </div>
  )
}
