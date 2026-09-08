import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function AdminUsersLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading users" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Skeleton className="h-10 w-full sm:w-72" />
          <Skeleton className="h-10 w-full sm:w-44" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      <Skeleton className="h-4 w-56" />
      <TableSkeleton rows={8} columns={7} />
      <span className="sr-only">Loading users…</span>
    </div>
  )
}
