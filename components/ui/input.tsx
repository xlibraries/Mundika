import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const field =
  "w-full rounded border border-[#dadce0] bg-white px-3 py-2 text-sm text-[#202124] placeholder:text-[#80868b] outline-none transition focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8]";

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
        "cursor-pointer appearance-none bg-white",
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
