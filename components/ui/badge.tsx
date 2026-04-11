import { cn } from "@/lib/cn";

export function Badge({
  variant = "default",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "muted";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        variant === "default" &&
          "border border-[var(--gs-border)] bg-[var(--gs-surface)] text-[var(--gs-text-secondary)]",
        variant === "success" &&
          "border border-[var(--gs-success)]/35 bg-[var(--gs-success-soft)] text-[var(--gs-success)]",
        variant === "warning" &&
          "border border-[var(--gs-warning)]/40 bg-[var(--gs-warning-soft)] text-[var(--gs-warning)]",
        variant === "muted" && "border-0 bg-transparent text-[var(--gs-text-secondary)]",
        className
      )}
      {...props}
    />
  );
}
