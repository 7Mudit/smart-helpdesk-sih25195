'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, LogOut, Menu, Search, User as UserIcon } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/dropdown'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { useToast } from '@/components/ui/toast'
import type { SessionUser } from '@/lib/auth'

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: 'Employee',
  AGENT: 'Agent',
  ADMIN: 'Administrator',
}

export interface TopbarProps {
  user: SessionUser
  onOpenSidebar: () => void
}

export function Topbar({ user, onOpenSidebar }: TopbarProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [query, setQuery] = React.useState('')
  const [signingOut, setSigningOut] = React.useState(false)

  function onSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const q = query.trim()
    router.push(q ? `/tickets?search=${encodeURIComponent(q)}` : '/tickets')
  }

  async function signOut() {
    if (signingOut) return
    setSigningOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Even if the call fails we still send the user to /login; the cookie
      // is httpOnly so there is nothing useful to clear client-side.
      toast('Could not reach the server — signing out locally.', 'warning')
    }
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur-sm sm:px-6">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open navigation menu"
        aria-controls="app-sidebar"
        className="-ml-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card md:hidden"
      >
        <Menu aria-hidden="true" className="h-5 w-5" />
      </button>

      <form role="search" onSubmit={onSearch} className="min-w-0 flex-1 sm:max-w-md">
        <label htmlFor="global-search" className="sr-only">
          Search tickets by number, title or description
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="global-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tickets…"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          />
        </div>
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ThemeToggle />

        <Dropdown
          align="end"
          label="Account menu"
          triggerClassName="h-10 gap-2 rounded-md border border-border bg-card pl-1.5 pr-2 hover:bg-accent"
          menuClassName="w-60"
          trigger={
            <>
              <Avatar name={user.name} id={user.id} size="sm" />
              <span className="hidden max-w-[9rem] truncate text-sm font-medium sm:inline">
                {user.name}
              </span>
              <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            </>
          }
        >
          <div className="flex flex-col gap-1.5 px-3 py-2">
            <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            <Badge variant="secondary" className="mt-0.5 w-fit">
              <UserIcon aria-hidden="true" className="h-3 w-3" />
              {ROLE_LABEL[user.role] ?? user.role}
            </Badge>
          </div>

          <DropdownSeparator />

          <DropdownItem onClick={signOut} disabled={signingOut} destructive>
            <LogOut aria-hidden="true" className="h-4 w-4" />
            {signingOut ? 'Signing out…' : 'Sign out'}
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  )
}
