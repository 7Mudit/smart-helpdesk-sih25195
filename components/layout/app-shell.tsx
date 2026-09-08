'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import type { SessionUser } from '@/lib/auth'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export interface AppShellProps {
  user: SessionUser
  children: React.ReactNode
}

/**
 * Persistent chrome for every signed-in page: a fixed sidebar (a drawer under
 * `md`), a topbar, and the `#main` landmark that the root layout's skip-link
 * targets.
 */
export function AppShell({ user, children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const pathname = usePathname()

  // Route changes close the mobile drawer.
  React.useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Escape closes the drawer wherever focus happens to be.
  React.useEffect(() => {
    if (!sidebarOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sidebarOpen])

  const close = React.useCallback(() => setSidebarOpen(false), [])
  const open = React.useCallback(() => setSidebarOpen(true), [])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={user.role} open={sidebarOpen} onClose={close} />

      <div className="flex min-h-screen flex-col md:pl-64">
        <Topbar user={user} onOpenSidebar={open} />
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppShell
