import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const field =
  "w-full rounded-lg border border-white/10 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/25";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, className)} {...props} />;
}

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        field,
        "cursor-pointer appearance-none bg-zinc-900/60",
        className
      )}
      {...props}
    />
  );
});

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(field, "min-h-[88px] resize-y", className)} {...props} />
  );
}
