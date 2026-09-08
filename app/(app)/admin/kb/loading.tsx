import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function AdminKbLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading knowledge base" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Skeleton className="h-10 w-full sm:w-72" />
          <Skeleton className="h-10 w-full sm:w-40" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <Skeleton className="h-4 w-72" />
      <TableSkeleton rows={8} columns={8} />
      <span className="sr-only">Loading knowledge base…</span>
    </div>
  )
}
