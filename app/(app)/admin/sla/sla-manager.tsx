'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Pencil, Timer } from 'lucide-react'
import { LABELS, type Priority } from '@/lib/constants'
import { formatDuration } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { PriorityBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { FormField, Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

export interface AdminSlaPolicy {
  id: string
  name: string
  priority: string
  firstResponseMins: number
  resolutionMins: number
  businessHoursOnly: boolean
  isActive: boolean
  ticketCount: number
}

async function errorFrom(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: string
      issues?: { path: string; message: string }[]
    }
    if (body.issues?.length) return body.issues.map((i) => `${i.path}: ${i.message}`).join(', ')
    return body.error ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

interface EditState {
  name: string
  firstResponseMins: string
  resolutionMins: string
  businessHoursOnly: boolean
  isActive: boolean
}

export function SlaManager({ policies }: { policies: AdminSlaPolicy[] }) {
  const router = useRouter()
  const { toast } = useToast()

  const [editing, setEditing] = React.useState<AdminSlaPolicy | null>(null)
  const [form, setForm] = React.useState<EditState | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function openEdit(p: AdminSlaPolicy) {
    setForm({
      name: p.name,
      firstResponseMins: String(p.firstResponseMins),
      resolutionMins: String(p.resolutionMins),
      businessHoursOnly: p.businessHoursOnly,
      isActive: p.isActive,
    })
    setError(null)
    setEditing(p)
  }

  function close() {
    setEditing(null)
    setForm(null)
    setError(null)
  }

  async function save() {
    if (!editing || !form) return

    const firstResponseMins = Number(form.firstResponseMins)
    const resolutionMins = Number(form.resolutionMins)

    if (!Number.isInteger(firstResponseMins) || firstResponseMins < 1) {
      setError('First response target must be a whole number of minutes, at least 1.')
      return
    }
    if (!Number.isInteger(resolutionMins) || resolutionMins < 1) {
      setError('Resolution target must be a whole number of minutes, at least 1.')
      return
    }
    if (resolutionMins < firstResponseMins) {
      setError('Resolution target cannot be shorter than the first-response target.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/sla/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          priority: editing.priority,
          firstResponseMins,
          resolutionMins,
          businessHoursOnly: form.businessHoursOnly,
          isActive: form.isActive,
        }),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      toast(`${form.name} updated`, 'success')
      close()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the policy')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {policies.map((p) => (
          <Card key={p.id} className="flex flex-col">
            <CardHeader className="gap-3 pb-4">
              <div className="flex items-start justify-between gap-2">
                <PriorityBadge priority={p.priority as Priority} />
                <Badge variant={p.isActive ? 'success' : 'secondary'}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <CardTitle>{p.name}</CardTitle>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-4">
              <dl className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock aria-hidden="true" className="h-4 w-4" />
                    First response
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {formatDuration(p.firstResponseMins)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Timer aria-hidden="true" className="h-4 w-4" />
                    Resolution
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {formatDuration(p.resolutionMins)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-sm text-muted-foreground">Clock</dt>
                  <dd className="text-right text-xs font-medium text-foreground">
                    {p.businessHoursOnly ? 'Business hours' : 'Calendar (24×7)'}
                  </dd>
                </div>
              </dl>

              <p className="mt-auto text-xs text-muted-foreground">
                Applied to {p.ticketCount} ticket{p.ticketCount === 1 ? '' : 's'}
              </p>

              <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                Edit policy
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog
        open={editing !== null}
        onClose={close}
        title={editing ? `Edit ${LABELS.priority[editing.priority as Priority]} policy` : 'Edit policy'}
        description="Changes apply to tickets raised from now on. Existing deadlines are not rewritten."
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void save()}>
              Save policy
            </Button>
          </>
        }
      >
        {form ? (
          <div className="flex flex-col gap-4">
            <FormField label="Policy name" htmlFor="sla-name" required>
              <Input
                id="sla-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="First response (minutes)"
                htmlFor="sla-first"
                required
                hint={
                  Number(form.firstResponseMins) > 0
                    ? `= ${formatDuration(Number(form.firstResponseMins))}`
                    : undefined
                }
              >
                <Input
                  id="sla-first"
                  type="number"
                  min={1}
                  value={form.firstResponseMins}
                  onChange={(e) => setForm({ ...form, firstResponseMins: e.target.value })}
                />
              </FormField>

              <FormField
                label="Resolution (minutes)"
                htmlFor="sla-resolution"
                required
                hint={
                  Number(form.resolutionMins) > 0
                    ? `= ${formatDuration(Number(form.resolutionMins))}`
                    : undefined
                }
              >
                <Input
                  id="sla-resolution"
                  type="number"
                  min={1}
                  value={form.resolutionMins}
                  onChange={(e) => setForm({ ...form, resolutionMins: e.target.value })}
                />
              </FormField>
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-4">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.businessHoursOnly}
                  onChange={(e) => setForm({ ...form, businessHoursOnly: e.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">Business hours only</span>
                  <span className="text-xs text-muted-foreground">
                    Clock runs Mon–Fri 09:00–18:00 IST. Uncheck for round-the-clock targets.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">Active</span>
                  <span className="text-xs text-muted-foreground">
                    Inactive policies are skipped; those tickets get no SLA deadline.
                  </span>
                </span>
              </label>
            </div>

            {error ? (
              <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  )
}
