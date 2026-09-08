import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Classes for the overflow wrapper around the table. */
  wrapperClassName?: string
}

export const Table = React.forwardRef<HTMLTableElement, TableProps>(function Table(
  { className, wrapperClassName, ...props },
  ref
) {
  return (
    <div
      className={cn(
        'relative w-full overflow-x-auto overflow-y-auto scrollbar-thin rounded-lg border border-border bg-card',
        wrapperClassName
      )}
    >
      <table
        ref={ref}
        className={cn('w-full caption-bottom border-collapse text-sm', className)}
        {...props}
      />
    </div>
  )
})

export const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableHeader({ className, ...props }, ref) {
  return (
    <thead
      ref={ref}
      className={cn('sticky top-0 z-10 bg-muted/95 backdrop-blur-sm', className)}
      {...props}
    />
  )
})

export const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn('divide-y divide-border', className)} {...props} />
})

export const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn('border-t border-border bg-muted/50 font-medium', className)}
      {...props}
    />
  )
})

export const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(function TableRow({ className, ...props }, ref) {
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b border-border transition-colors last:border-0 hover:bg-accent/60 data-[state=selected]:bg-accent',
        className
      )}
      {...props}
    />
  )
})

export const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(function TableHead({ className, scope = 'col', ...props }, ref) {
  return (
    <th
      ref={ref}
      scope={scope}
      className={cn(
        'h-10 whitespace-nowrap border-b border-border px-4 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        className
      )}
      {...props}
    />
  )
})

export const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(function TableCell({ className, ...props }, ref) {
  return <td ref={ref} className={cn('px-4 py-3 align-middle', className)} {...props} />
})

export const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(function TableCaption({ className, ...props }, ref) {
  return <caption ref={ref} className={cn('mt-3 text-sm text-muted-foreground', className)} {...props} />
})
