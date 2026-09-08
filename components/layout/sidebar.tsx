'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BookOpen,
  FileText,
  GitBranch,
  LayoutDashboard,
  PlusCircle,
  Ticket,
  Timer,
  Users,
  X,
  Zap,
} from 'lucide-react'
import type { Role } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { isActive, visibleNav, type NavItem } from './nav-items'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Ticket,
  PlusCircle,
  BookOpen,
  Users,
  Timer,
  GitBranch,
  FileText,
}

export interface SidebarProps {
  role: Role
  /** Mobile drawer state — ignored by the static desktop rail. */
  open: boolean
  onClose: () => void
}

export function Sidebar({ role, open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const sections = React.useMemo(() => visibleNav(role), [role])

  return (
    <>
      {/* Mobile scrim */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      <nav
        id="app-sidebar"
        aria-label="Main navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-card',
          'transition-transform duration-200 ease-out',
          'md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            >
              <Zap className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold tracking-tight">
                Smart Helpdesk
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                Ministry of Power
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
          {sections.map((section, i) => (
            <div key={section.title ?? `section-${i}`} className={cn(i > 0 && 'mt-6')}>
              {section.title ? (
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
              ) : null}
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <li key={item.href}>
                    <SidebarLink
                      item={item}
                      active={isActive(pathname, item)}
                      onNavigate={onClose}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-border px-4 py-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            SIH25195 · Smart Automation
          </p>
        </div>
      </nav>
    </>
  )
}

function SidebarLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem
  active: boolean
  onNavigate: () => void
}) {
  const Icon = ICONS[item.icon] ?? Ticket

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
        active
          ? 'bg-primary/10 text-primary dark:bg-primary/20'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
      />
      <span className="truncate">{item.label}</span>
      {active ? <span className="sr-only">(current page)</span> : null}
    </Link>
  )
}
