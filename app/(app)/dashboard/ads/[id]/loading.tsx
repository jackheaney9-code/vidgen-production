import { Skeleton } from "@/components/ui/skeleton"

export default function AdLoading() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <Skeleton className="aspect-[4/5] rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  )
}
