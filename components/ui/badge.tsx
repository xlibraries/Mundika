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
          "border border-[#dadce0] bg-[#f8f9fa] text-[#5f6368]",
        variant === "success" &&
          "border border-[#ceead6] bg-[#e6f4ea] text-[#188038]",
        variant === "warning" &&
          "border border-[#fde293] bg-[#fef7e0] text-[#b06000]",
        variant === "muted" && "border-0 bg-transparent text-[#5f6368]",
        className
      )}
      {...props}
    />
  );
}
