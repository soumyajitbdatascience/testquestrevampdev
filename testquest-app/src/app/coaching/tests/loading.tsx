import { Skeleton } from "@/components/ui/skeleton";

export default function TestsLoading() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <header className="relative border-b">
        <div className="mx-auto max-w-[1280px] h-[64px] flex items-center justify-between px-6 lg:px-10">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
      </header>
      <main className="relative mx-auto max-w-[1100px] px-6 lg:px-10 py-8">
        <Skeleton className="mb-6 h-3 w-32" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-9 w-64" />
        <Skeleton className="mt-2 h-3 w-96" />
        <div className="mt-8 rounded-[14px] border bg-surface divide-y">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-72" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
