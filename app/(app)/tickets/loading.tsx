import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function TicketsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>

      <TableSkeleton rows={8} columns={7} />
    </div>
  )
}
