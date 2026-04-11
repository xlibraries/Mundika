import { cn } from "@/lib/cn";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded font-medium shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-40",
        variant === "primary" &&
          "bg-[var(--gs-primary)] text-[var(--gs-surface-plain)] hover:bg-[var(--gs-primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gs-primary)]",
        variant === "secondary" &&
          "border border-[var(--gs-border)] bg-[var(--gs-surface-plain)] text-[var(--gs-text)] shadow-none hover:bg-[var(--gs-surface)] hover:border-[var(--gs-grid)]",
        variant === "ghost" &&
          "text-[var(--gs-text-secondary)] shadow-none hover:bg-[var(--gs-surface-hover)] hover:text-[var(--gs-text)]",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-sm",
        className
      )}
      {...props}
    />
  );
}
