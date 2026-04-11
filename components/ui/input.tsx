import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const field =
  "w-full rounded border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] px-3 py-2 text-sm text-[var(--gs-text)] placeholder:text-[var(--gs-text-secondary)] outline-none transition focus:border-[var(--gs-primary)] focus:ring-1 focus:ring-[var(--gs-primary)]";

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(field, className)} {...props} />;
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        field,
        "cursor-pointer appearance-none bg-[var(--gs-surface-plain)]",
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
