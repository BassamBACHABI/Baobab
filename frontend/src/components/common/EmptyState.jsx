import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
  className,
  testId = "empty-state",
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Icon className="h-8 w-8" strokeWidth={1.75} />
        </div>
      )}
      <h3 className="text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant="outline"
          className="mt-6 rounded-xl"
          onClick={onAction}
          data-testid={`${testId}-action`}
        >
          {action}
        </Button>
      )}
    </div>
  );
}
