'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type DropdownAlign = 'start' | 'end'

export interface DropdownProps {
  /** Rendered inside the trigger button. */
  trigger: React.ReactNode
  children: React.ReactNode
  align?: DropdownAlign
  className?: string
  menuClassName?: string
  triggerClassName?: string
  /** Accessible name — required when the trigger is icon-only. */
  label?: string
}

interface DropdownContextValue {
  close: () => void
}

const DropdownContext = React.createContext<DropdownContextValue>({ close: () => {} })

export function Dropdown({
  trigger,
  children,
  align = 'end',
  className,
  menuClassName,
  triggerClassName,
  label,
}: DropdownProps) {
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const menuId = React.useId()

  const close = React.useCallback(() => setOpen(false), [])

  React.useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent | TouchEvent) {
      const node = event.target as Node | null
      if (node && rootRef.current && !rootRef.current.contains(node)) setOpen(false)
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const ctx = React.useMemo<DropdownContextValue>(() => ({ close }), [close])

  return (
    <div ref={rootRef} className={cn('relative inline-block text-left', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          triggerClassName
        )}
      >
        {trigger}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-orientation="vertical"
          className={cn(
            'animate-in-up absolute z-40 mt-2 min-w-[11rem] overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg',
            align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
            menuClassName
          )}
        >
          <DropdownContext.Provider value={ctx}>{children}</DropdownContext.Provider>
        </div>
      ) : null}
    </div>
  )
}

export interface DropdownItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Renders in destructive red. */
  destructive?: boolean
  /** Keep the menu open after activation. */
  keepOpen?: boolean
}

export const DropdownItem = React.forwardRef<HTMLButtonElement, DropdownItemProps>(
  function DropdownItem({ className, destructive = false, keepOpen = false, onClick, ...props }, ref) {
    const { close } = React.useContext(DropdownContext)
    return (
      <button
        ref={ref}
        type="button"
        role="menuitem"
        onClick={(event) => {
          onClick?.(event)
          if (!keepOpen) close()
        }}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
          'disabled:pointer-events-none disabled:opacity-50',
          destructive
            ? 'text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300'
            : 'text-foreground',
          className
        )}
        {...props}
      />
    )
  }
)

export function DropdownSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cn('my-1 h-px bg-border', className)} />
}

export function DropdownLabel({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('px-3 py-1.5 text-xs font-semibold text-muted-foreground', className)}>
      {children}
    </div>
  )
}
