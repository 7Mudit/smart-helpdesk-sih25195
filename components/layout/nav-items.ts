import type { Role } from '@/lib/constants'
import { can, type Permission } from '@/lib/rbac'

export interface NavItem {
  href: string
  /** Label when the viewer is not an agent/admin. */
  label: string
  /** Overrides `label` for AGENT / ADMIN. */
  staffLabel?: string
  /** Lucide icon name — resolved in the sidebar's icon map. */
  icon: string
  /** When set, the item only renders if `can(role, permission)`. */
  permission?: Permission
  /** Match nested routes too (e.g. /tickets/abc highlights "Tickets"). */
  exact?: boolean
}

export interface NavSection {
  /** Section heading; omitted for the primary group. */
  title?: string
  items: NavItem[]
  permission?: Permission
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        href: '/dashboard',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        permission: 'dashboard:view',
      },
      {
        href: '/tickets',
        label: 'My Tickets',
        staffLabel: 'All Tickets',
        icon: 'Ticket',
        exact: true,
      },
      { href: '/tickets/new', label: 'Raise a Ticket', icon: 'PlusCircle', exact: true },
      { href: '/kb', label: 'Knowledge Base', icon: 'BookOpen' },
    ],
  },
  {
    title: 'Administration',
    permission: 'user:read',
    items: [
      { href: '/admin/users', label: 'Users', icon: 'Users' },
      { href: '/admin/sla', label: 'SLA Policies', icon: 'Timer' },
      { href: '/admin/rules', label: 'Routing Rules', icon: 'GitBranch' },
      { href: '/admin/kb', label: 'KB Editor', icon: 'FileText' },
    ],
  },
]

/** The sections and items this role may actually see, with labels resolved. */
export function visibleNav(role: Role): { title?: string; items: NavItem[] }[] {
  const staff = role === 'AGENT' || role === 'ADMIN'

  return NAV_SECTIONS.filter((section) => !section.permission || can(role, section.permission))
    .map((section) => ({
      title: section.title,
      items: section.items
        .filter((item) => !item.permission || can(role, item.permission))
        .map((item) => ({
          ...item,
          label: staff && item.staffLabel ? item.staffLabel : item.label,
        })),
    }))
    .filter((section) => section.items.length > 0)
}

/** True when `pathname` should highlight `item`. */
export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
