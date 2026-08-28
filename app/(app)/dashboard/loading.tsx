import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-8 w-40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="aspect-[4/5] rounded-xl" />
        <Skeleton className="aspect-[4/5] rounded-xl" />
        <Skeleton className="aspect-[4/5] rounded-xl" />
      </div>
    </div>
  )
}
