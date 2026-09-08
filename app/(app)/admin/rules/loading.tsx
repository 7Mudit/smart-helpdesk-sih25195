import { CardSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function AdminRulesLoading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading routing rules" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Skeleton className="h-24 w-full max-w-3xl rounded-lg" />
        <Skeleton className="h-10 w-28 shrink-0" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} lines={5} />
        ))}
      </div>

      <span className="sr-only">Loading routing rules…</span>
    </div>
  )
}
