/**
 * Skeleton variants matched to the coaching component vocabulary
 * (UI_PLAN §6.3). Render these on initial page load instead of a spinner.
 *
 *  - StatTileSkeleton           ↔ StatTile
 *  - StudentRowSkeleton         ↔ StudentListItem / monitor student row
 *  - BatchCardSkeleton          ↔ BatchListItem
 *  - ActivityFeedItemSkeleton   ↔ ActivityFeedItem
 *  - AssignmentCardSkeleton     ↔ AssignmentCard
 */
import { Skeleton } from "@/components/ui/skeleton";

export function StatTileSkeleton() {
  return (
    <div className="rounded-[14px] border bg-surface p-5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="mt-4 h-8 w-16" />
    </div>
  );
}

export function StudentRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-3 w-10" />
    </div>
  );
}

export function BatchCardSkeleton() {
  return (
    <div className="rounded-[14px] border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export function ActivityFeedItemSkeleton() {
  return (
    <div className="flex items-center justify-between gap-4 px-2 py-3">
      <div className="space-y-2 min-w-0 flex-1">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-2.5 w-24" />
      </div>
      <Skeleton className="h-3 w-10" />
    </div>
  );
}

export function AssignmentCardSkeleton() {
  return (
    <div className="rounded-[14px] border bg-surface p-4 space-y-3">
      <Skeleton className="h-4 w-48" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
