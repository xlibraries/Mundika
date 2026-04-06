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
        variant === "default" && "bg-white/10 text-zinc-300",
        variant === "success" && "bg-emerald-500/15 text-emerald-400",
        variant === "warning" && "bg-amber-500/15 text-amber-400",
        variant === "muted" && "bg-transparent text-zinc-500",
        className
      )}
      {...props}
    />
  );
}
