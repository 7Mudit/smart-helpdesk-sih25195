import { CardSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function KbLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-11 w-full max-w-xl" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} lines={3} />
        ))}
      </div>
    </div>
  )
}
