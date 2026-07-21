import { Skeleton } from "@/components/ui/skeleton";

export default function BillingLoading() {
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
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-9 w-64" />

        <div className="mt-6 rounded-[18px] border bg-surface p-5 space-y-4">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-3 w-40" />
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-[18px] border bg-surface p-5 space-y-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="mt-3 h-10 w-full" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
