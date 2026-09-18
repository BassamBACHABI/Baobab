import { Skeleton } from "@/components/ui/skeleton";

export function ListSkeleton({ rows = 4, testId = "list-skeleton" }) {
  return (
    <div className="space-y-3" data-testid={testId}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
        >
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5 rounded-md" />
            <Skeleton className="h-3 w-3/5 rounded-md" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <Skeleton className="h-3 w-24 rounded-md" />
      <Skeleton className="mt-4 h-8 w-16 rounded-md" />
    </div>
  );
}
