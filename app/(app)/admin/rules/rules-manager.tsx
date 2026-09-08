'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowUp,
  GitBranch,
  ListOrdered,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  CATEGORIES,
  DEPARTMENTS,
  LABELS,
  PRIORITIES,
  type Category,
  type Department,
  type Priority,
} from '@/lib/constants'
import { Badge, PriorityBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField, Input, Select } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

export interface AdminRule {
  id: string
  name: string
  priority: number
  matchCategory: string | null
  matchKeywords: string
  matchPriority: string | null
  assignDepartment: string
  assignToUserId: string | null
  assignToName: string | null
  setPriority: string | null
  isActive: boolean
}

export interface RuleAssignee {
  id: string
  name: string
  department: string | null
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

interface RuleForm {
  name: string
  matchCategory: string
  matchKeywords: string
  matchPriority: string
  assignDepartment: string
  assignToUserId: string
  setPriority: string
  isActive: boolean
}

const EMPTY_RULE: RuleForm = {
  name: '',
  matchCategory: '',
  matchKeywords: '',
  matchPriority: '',
  assignDepartment: 'GENERAL',
  assignToUserId: '',
  setPriority: '',
  isActive: true,
}

export function RulesManager({
  rules,
  agents,
}: {
  rules: AdminRule[]
  agents: RuleAssignee[]
}) {
  const router = useRouter()
  const { toast } = useToast()

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AdminRule | null>(null)
  const [deleting, setDeleting] = React.useState<AdminRule | null>(null)
  const [form, setForm] = React.useState<RuleForm>(EMPTY_RULE)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  function openCreate() {
    setForm(EMPTY_RULE)
    setError(null)
    setCreateOpen(true)
  }

  function openEdit(r: AdminRule) {
    setForm({
      name: r.name,
      matchCategory: r.matchCategory ?? '',
      matchKeywords: r.matchKeywords,
      matchPriority: r.matchPriority ?? '',
      assignDepartment: r.assignDepartment,
      assignToUserId: r.assignToUserId ?? '',
      setPriority: r.setPriority ?? '',
      isActive: r.isActive,
    })
    setError(null)
    setEditing(r)
  }

  function close() {
    setCreateOpen(false)
    setEditing(null)
    setDeleting(null)
    setError(null)
  }

  function payload(priority: number) {
    return {
      name: form.name,
      priority,
      matchCategory: form.matchCategory || null,
      matchKeywords: form.matchKeywords,
      matchPriority: form.matchPriority || null,
      assignDepartment: form.assignDepartment,
      assignToUserId: form.assignToUserId || null,
      setPriority: form.setPriority || null,
      isActive: form.isActive,
    }
  }

  async function submitCreate() {
    if (form.name.trim().length < 2) {
      setError('Give the rule a name of at least 2 characters.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      // New rules go to the end of the chain so they cannot silently shadow
      // an existing, more specific rule.
      const nextPriority = rules.length > 0 ? Math.max(...rules.map((r) => r.priority)) + 10 : 100
      const res = await fetch('/api/admin/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(Math.min(nextPriority, 1000))),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      toast(`Rule "${form.name}" created`, 'success')
      close()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the rule')
    } finally {
      setSaving(false)
    }
  }

  async function submitEdit() {
    if (!editing) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/rules/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload(editing.priority)),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      toast(`Rule "${form.name}" updated`, 'success')
      close()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the rule')
    } finally {
      setSaving(false)
    }
  }

  async function patchRule(rule: AdminRule, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await errorFrom(res))
  }

  async function toggleActive(rule: AdminRule) {
    setBusyId(rule.id)
    try {
      await patchRule(rule, { isActive: !rule.isActive })
      toast(`Rule ${rule.isActive ? 'disabled' : 'enabled'}`, 'success')
      router.refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update the rule', 'error')
    } finally {
      setBusyId(null)
    }
  }

  /** Swaps this rule's `priority` with its neighbour's, so order is persisted. */
  async function move(index: number, direction: -1 | 1) {
    const rule = rules[index]
    const neighbour = rules[index + direction]
    if (!rule || !neighbour) return

    setBusyId(rule.id)
    try {
      await patchRule(rule, { priority: neighbour.priority })
      await patchRule(neighbour, { priority: rule.priority })
      toast('Rule order updated', 'success')
      router.refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not reorder the rules', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/rules/${deleting.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await errorFrom(res))
      toast(`Rule "${deleting.name}" deleted`, 'success')
      close()
      router.refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not delete the rule', 'error')
    } finally {
      setSaving(false)
    }
  }

  const fields = (
    <div className="flex flex-col gap-4">
      <FormField label="Rule name" htmlFor="rule-name" required>
        <Input
          id="rule-name"
          value={form.name}
          placeholder="VPN issues to Network Operations"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </FormField>

      <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Match when
        </legend>
        <p className="text-xs text-muted-foreground">
          All the criteria you set must match. Leave a field blank to ignore it.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Category is" htmlFor="rule-cat">
            <Select
              id="rule-cat"
              value={form.matchCategory}
              onChange={(e) => setForm({ ...form, matchCategory: e.target.value })}
            >
              <option value="">Any category</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {LABELS.category[c as Category]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Priority is" htmlFor="rule-match-pri">
            <Select
              id="rule-match-pri"
              value={form.matchPriority}
              onChange={(e) => setForm({ ...form, matchPriority: e.target.value })}
            >
              <option value="">Any priority</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {LABELS.priority[p as Priority]}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField
          label="Keywords"
          htmlFor="rule-keywords"
          hint="Comma-separated, case-insensitive. Matched against the title and description."
        >
          <Input
            id="rule-keywords"
            value={form.matchKeywords}
            placeholder="vpn, firewall, proxy"
            onChange={(e) => setForm({ ...form, matchKeywords: e.target.value })}
          />
        </FormField>
      </fieldset>

      <fieldset className="flex flex-col gap-4 rounded-md border border-border p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Then do
        </legend>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Assign to department" htmlFor="rule-dept" required>
            <Select
              id="rule-dept"
              value={form.assignDepartment}
              onChange={(e) => setForm({ ...form, assignDepartment: e.target.value })}
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {LABELS.department[d as Department]}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label="Assign to agent"
            htmlFor="rule-agent"
            hint="Leave blank to load-balance across the department."
          >
            <Select
              id="rule-agent"
              value={form.assignToUserId}
              onChange={(e) => setForm({ ...form, assignToUserId: e.target.value })}
            >
              <option value="">Load balance</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField
          label="Override priority"
          htmlFor="rule-set-pri"
          hint="Optional. Forces the priority regardless of what the classifier decided."
        >
          <Select
            id="rule-set-pri"
            value={form.setPriority}
            onChange={(e) => setForm({ ...form, setPriority: e.target.value })}
          >
            <option value="">Keep classifier priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {LABELS.priority[p as Priority]}
              </option>
            ))}
          </Select>
        </FormField>
      </fieldset>

      <label className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground">Active</span>
          <span className="text-xs text-muted-foreground">
            Inactive rules are skipped during evaluation but kept for reference.
          </span>
        </span>
      </label>

      {error ? (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  )

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
          <span
            aria-hidden="true"
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20"
          >
            <ListOrdered className="h-4 w-4" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">
              Evaluated top to bottom — first match wins
            </p>
            <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
              When a ticket is raised, the engine walks this list in order and stops at the first
              active rule whose criteria all match. Put your most specific rules at the top. If no
              rule matches, the ticket falls through to load-balanced assignment within{' '}
              <span className="font-medium text-foreground">General Support</span>.
            </p>
          </div>
        </div>

        <Button onClick={openCreate} className="shrink-0">
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="h-6 w-6" />}
          title="No routing rules yet"
          description="Every ticket will be load-balanced into General Support until you add a rule."
          action={
            <Button onClick={openCreate}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add the first rule
            </Button>
          }
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {rules.map((rule, i) => (
            <li key={rule.id}>
              <Card className={rule.isActive ? undefined : 'opacity-70'}>
                <CardHeader className="flex-row items-start justify-between gap-4 pb-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground"
                    >
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                      <CardTitle className="truncate">{rule.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Evaluation order {rule.priority}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant={rule.isActive ? 'success' : 'secondary'}>
                      {rule.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`Move "${rule.name}" up`}
                      disabled={i === 0 || busyId !== null}
                      onClick={() => void move(i, -1)}
                    >
                      <ArrowUp aria-hidden="true" className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`Move "${rule.name}" down`}
                      disabled={i === rules.length - 1 || busyId !== null}
                      onClick={() => void move(i, 1)}
                    >
                      <ArrowDown aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="flex flex-col gap-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Match when
                      </h4>
                      <ul className="flex flex-col gap-1.5 text-sm">
                        <li className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">Category</span>
                          {rule.matchCategory ? (
                            <Badge variant="outline">
                              {LABELS.category[rule.matchCategory as Category] ??
                                rule.matchCategory}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">any</span>
                          )}
                        </li>
                        <li className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">Priority</span>
                          {rule.matchPriority ? (
                            <PriorityBadge priority={rule.matchPriority as Priority} />
                          ) : (
                            <span className="text-muted-foreground">any</span>
                          )}
                        </li>
                        <li className="flex flex-wrap items-start gap-2">
                          <span className="shrink-0 text-muted-foreground">Keywords</span>
                          {rule.matchKeywords.trim() ? (
                            <span className="flex flex-wrap gap-1">
                              {rule.matchKeywords
                                .split(',')
                                .map((k) => k.trim())
                                .filter(Boolean)
                                .map((k) => (
                                  <Badge key={k} variant="secondary" className="font-mono text-[11px]">
                                    {k}
                                  </Badge>
                                ))}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">none</span>
                          )}
                        </li>
                      </ul>
                    </section>

                    <section className="flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Then do
                      </h4>
                      <ul className="flex flex-col gap-1.5 text-sm">
                        <li className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">Department</span>
                          <Badge variant="default">
                            {LABELS.department[rule.assignDepartment as Department] ??
                              rule.assignDepartment}
                          </Badge>
                        </li>
                        <li className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">Assignee</span>
                          <span className="font-medium text-foreground">
                            {rule.assignToName ?? 'Load balanced'}
                          </span>
                        </li>
                        <li className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">Priority override</span>
                          {rule.setPriority ? (
                            <PriorityBadge priority={rule.setPriority as Priority} />
                          ) : (
                            <span className="text-muted-foreground">none</span>
                          )}
                        </li>
                      </ul>
                    </section>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>
                      <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === rule.id}
                      onClick={() => void toggleActive(rule)}
                    >
                      {rule.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                      onClick={() => setDeleting(rule)}
                    >
                      <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <Dialog
        open={createOpen}
        onClose={close}
        title="Add routing rule"
        description="The new rule is appended to the end of the chain — reorder it afterwards."
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void submitCreate()}>
              Create rule
            </Button>
          </>
        }
      >
        {fields}
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={close}
        title="Edit routing rule"
        description="Evaluation order is unchanged — use the arrows on the card to move it."
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void submitEdit()}>
              Save rule
            </Button>
          </>
        }
      >
        {fields}
      </Dialog>

      <Dialog
        open={deleting !== null}
        onClose={close}
        title="Delete this rule?"
        description={
          deleting
            ? `"${deleting.name}" will be removed permanently. Tickets already routed by it are not affected.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" loading={saving} onClick={() => void confirmDelete()}>
              Delete rule
            </Button>
          </>
        }
      />
    </>
  )
}
