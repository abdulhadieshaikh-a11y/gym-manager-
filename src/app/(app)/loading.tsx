import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-2 h-8 w-56" />
      <Skeleton className="mb-6 h-4 w-80" />
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-44 rounded-[var(--radius-lg)]" />
        <Skeleton className="h-44 rounded-[var(--radius-lg)]" />
      </div>
      <div className="rounded-[var(--radius-lg)] bg-surface p-5 shadow-[var(--shadow-panel)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line py-3 last:border-0">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="h-4 w-1/5" />
            <Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
