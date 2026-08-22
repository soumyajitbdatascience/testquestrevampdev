/**
 * Streaming fallback while the dashboard server fetches finish.
 * Matches the layout in dashboard/page.tsx: header band + stat grid +
 * batch list + activity column.
 */
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatTileSkeleton,
  BatchCardSkeleton,
  ActivityFeedItemSkeleton,
} from "@/components/coaching/skeletons";

export default function DashboardLoading() {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <header className="relative border-b">
        <div className="mx-auto max-w-[1280px] h-[64px] flex items-center justify-between px-6 lg:px-10">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
      </header>

      <main className="relative mx-auto max-w-[1280px] px-6 lg:px-10 py-10">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>

        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
          <StatTileSkeleton />
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          <section>
            <Skeleton className="mb-4 h-5 w-24" />
            <div className="space-y-3">
              <BatchCardSkeleton />
              <BatchCardSkeleton />
              <BatchCardSkeleton />
            </div>
          </section>
          <aside>
            <Skeleton className="mb-4 h-5 w-36" />
            <div className="rounded-[14px] border bg-surface divide-y px-3">
              <ActivityFeedItemSkeleton />
              <ActivityFeedItemSkeleton />
              <ActivityFeedItemSkeleton />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
