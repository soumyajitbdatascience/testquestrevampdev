import { Skeleton } from "@/components/ui/skeleton";
import {
  StudentRowSkeleton,
  AssignmentCardSkeleton,
} from "@/components/coaching/skeletons";

export default function BatchDetailLoading() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <header className="relative border-b">
        <div className="mx-auto max-w-[1280px] h-[64px] flex items-center justify-between px-6 lg:px-10">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
      </header>

      <main className="relative mx-auto max-w-[1100px] px-6 lg:px-10 py-8">
        <Skeleton className="mb-6 h-3 w-32" />
        <div className="space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-10 w-72" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>

        <div className="mt-8">
          <Skeleton className="h-9 w-64" />
        </div>

        <div className="mt-6 rounded-[14px] border bg-surface divide-y">
          <StudentRowSkeleton />
          <StudentRowSkeleton />
          <StudentRowSkeleton />
          <StudentRowSkeleton />
        </div>

        <div className="mt-6 space-y-3">
          <AssignmentCardSkeleton />
          <AssignmentCardSkeleton />
        </div>
      </main>
    </div>
  );
}
