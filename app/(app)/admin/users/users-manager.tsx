'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Search, UserPlus, Users } from 'lucide-react'
import { DEPARTMENTS, LABELS, ROLES, type Department, type Role } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Dropdown, DropdownItem } from '@/components/ui/dropdown'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField, Input, Select } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  department: string | null
  employeeCode: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  assignedCount: number
}

const roleVariant: Record<string, BadgeVariant> = {
  ADMIN: 'default',
  AGENT: 'secondary',
  EMPLOYEE: 'outline',
}

const roleLabel: Record<string, string> = {
  ADMIN: 'Admin',
  AGENT: 'Agent',
  EMPLOYEE: 'Employee',
}

interface FormState {
  name: string
  email: string
  password: string
  role: Role
  department: string
  employeeCode: string
  phone: string
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  password: '',
  role: 'EMPLOYEE',
  department: '',
  employeeCode: '',
  phone: '',
}

/** Pulls a readable message out of the API's `{error, issues}` envelope. */
async function errorFrom(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: string
      issues?: { path: string; message: string }[]
    }
    if (body.issues?.length) {
      return body.issues.map((i) => `${i.path}: ${i.message}`).join(', ')
    }
    return body.error ?? `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

export function UsersManager({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUser[]
  currentUserId: string
}) {
  const router = useRouter()
  const { toast } = useToast()

  const [search, setSearch] = React.useState('')
  const [roleFilter, setRoleFilter] = React.useState<string>('ALL')

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AdminUser | null>(null)
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return initialUsers.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false
      if (!q) return true
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.employeeCode ?? '').toLowerCase().includes(q)
      )
    })
  }, [initialUsers, search, roleFilter])

  function openCreate() {
    setForm(EMPTY_FORM)
    setError(null)
    setCreateOpen(true)
  }

  function openEdit(u: AdminUser) {
    setForm({
      name: u.name,
      email: u.email,
      password: '',
      role: u.role as Role,
      department: u.department ?? '',
      employeeCode: u.employeeCode ?? '',
      phone: u.phone ?? '',
    })
    setError(null)
    setEditing(u)
  }

  function closeDialogs() {
    setCreateOpen(false)
    setEditing(null)
    setError(null)
  }

  async function submitCreate() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
          department: form.department || undefined,
          employeeCode: form.employeeCode || undefined,
          phone: form.phone || undefined,
        }),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      toast(`${form.name} added`, 'success')
      closeDialogs()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the user')
    } finally {
      setSaving(false)
    }
  }

  async function submitEdit() {
    if (!editing) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          role: form.role,
          department: form.department || undefined,
          employeeCode: form.employeeCode || undefined,
          phone: form.phone || undefined,
        }),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      toast(`${form.name} updated`, 'success')
      closeDialogs()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the user')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(u: AdminUser) {
    setPendingId(u.id)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.isActive }),
      })
      if (!res.ok) throw new Error(await errorFrom(res))
      toast(`${u.name} ${u.isActive ? 'deactivated' : 'activated'}`, 'success')
      router.refresh()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update the user', 'error')
    } finally {
      setPendingId(null)
    }
  }

  const activeCount = initialUsers.filter((u) => u.isActive).length

  const fields = (mode: 'create' | 'edit') => (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Full name" htmlFor={`${mode}-name`} required>
          <Input
            id={`${mode}-name`}
            value={form.name}
            autoComplete="off"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </FormField>
        <FormField label="Email" htmlFor={`${mode}-email`} required>
          <Input
            id={`${mode}-email`}
            type="email"
            value={form.email}
            autoComplete="off"
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </FormField>
      </div>

      {mode === 'create' ? (
        <FormField
          label="Password"
          htmlFor="create-password"
          required
          hint="At least 8 characters. The user can change it after first sign-in."
        >
          <Input
            id="create-password"
            type="password"
            value={form.password}
            autoComplete="new-password"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </FormField>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Role" htmlFor={`${mode}-role`} required>
          <Select
            id={`${mode}-role`}
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel[r]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Department" htmlFor={`${mode}-department`}>
          <Select
            id={`${mode}-department`}
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
          >
            <option value="">Not assigned</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {LABELS.department[d as Department]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Employee code" htmlFor={`${mode}-code`}>
          <Input
            id={`${mode}-code`}
            value={form.employeeCode}
            placeholder="MOP-4821"
            onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
          />
        </FormField>
        <FormField label="Phone" htmlFor={`${mode}-phone`}>
          <Input
            id={`${mode}-phone`}
            value={form.phone}
            placeholder="+91 98765 43210"
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </FormField>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  )

  return (
    <>
      {/* toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-2">
            <label htmlFor="user-search" className="text-sm font-medium text-foreground">
              Search
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="user-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email or employee code"
                className="w-full pl-9 sm:w-72"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="role-filter" className="text-sm font-medium text-foreground">
              Role
            </label>
            <Select
              id="role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full sm:w-44"
            >
              <option value="ALL">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <Button onClick={openCreate}>
          <UserPlus aria-hidden="true" className="h-4 w-4" />
          Add user
        </Button>
      </div>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {filtered.length} of {initialUsers.length} users · {activeCount} active
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No users match"
          description="Try a different search term or clear the role filter."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Employee code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} id={u.id} size="md" />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-foreground">
                        {u.name}
                        {u.id === currentUserId ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={roleVariant[u.role] ?? 'outline'}>
                    {roleLabel[u.role] ?? u.role}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {u.department
                    ? LABELS.department[u.department as Department] ?? u.department
                    : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {u.employeeCode ?? '—'}
                </TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? 'success' : 'secondary'}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(u.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Dropdown
                    label={`Actions for ${u.name}`}
                    trigger={
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card hover:bg-accent">
                        <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                      </span>
                    }
                  >
                    <DropdownItem onClick={() => openEdit(u)}>Edit details</DropdownItem>
                    <DropdownItem
                      destructive={u.isActive}
                      disabled={pendingId === u.id || u.id === currentUserId}
                      onClick={() => void toggleActive(u)}
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </DropdownItem>
                  </Dropdown>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={createOpen}
        onClose={closeDialogs}
        title="Add user"
        description="Creates an account that can sign in immediately."
        footer={
          <>
            <Button variant="outline" onClick={closeDialogs} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void submitCreate()}>
              Create user
            </Button>
          </>
        }
      >
        {fields('create')}
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={closeDialogs}
        title="Edit user"
        description={editing ? `${editing.assignedCount} tickets currently assigned.` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={closeDialogs} disabled={saving}>
              Cancel
            </Button>
            <Button loading={saving} onClick={() => void submitEdit()}>
              Save changes
            </Button>
          </>
        }
      >
        {fields('edit')}
      </Dialog>
    </>
  )
}
