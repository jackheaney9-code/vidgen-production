import { Skeleton } from "@/components/ui/skeleton"

export default function GenerationLoading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-10 w-64" />
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-[9/16] rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
