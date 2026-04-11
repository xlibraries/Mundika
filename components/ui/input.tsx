import { forwardRef } from "react";
import { cn } from "@/lib/cn";

const field =
  "w-full rounded border border-[#c5dccf] bg-[#faf9f5] px-3 py-2 text-sm text-[#2a382f] placeholder:text-[#6f7f74] outline-none transition focus:border-[#6b9b7a] focus:ring-1 focus:ring-[#6b9b7a]";

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
