import { CardSkeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading dashboard" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-7 rounded-md" />
            </div>
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-4 w-56" />
        <Skeleton className="mt-6 h-[220px] w-full" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-4 w-52" />
            <Skeleton className="mt-6 h-[200px] w-full" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CardSkeleton lines={5} />
        <TableSkeleton rows={5} columns={4} />
      </div>

      <span className="sr-only">Loading dashboard…</span>
    </div>
  )
}
