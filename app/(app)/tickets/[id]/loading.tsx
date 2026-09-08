import { CardSkeleton, Skeleton } from '@/components/ui/skeleton'

export default function TicketDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-24" />
          ))}
        </div>
        <Skeleton className="h-8 w-3/4 max-w-xl" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6">
          <CardSkeleton lines={4} />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <CardSkeleton lines={2} className="flex-1" />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={3} />
          <CardSkeleton lines={5} />
        </div>
      </div>
    </div>
  )
}
