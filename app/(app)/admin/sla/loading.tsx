import { CardSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function AdminSlaLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading SLA policies" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} lines={4} />
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <Skeleton className="h-5 w-64" />
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Loading SLA policies…</span>
    </div>
  )
}
