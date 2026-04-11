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
          "border border-[#c5dccf] bg-[#f4f8f5] text-[#5c6e62]",
        variant === "success" &&
          "border border-[#c5e5cf] bg-[#e4f2e8] text-[#3d6b4f]",
        variant === "warning" &&
          "border border-[#fde293] bg-[#fef7e0] text-[#b06000]",
        variant === "muted" && "border-0 bg-transparent text-[#5c6e62]",
        className
      )}
      {...props}
    />
  );
}
