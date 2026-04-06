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
          "bg-[#1a73e8] text-white hover:bg-[#1557b0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a73e8]",
        variant === "secondary" &&
          "border border-[#dadce0] bg-white text-[#202124] shadow-none hover:bg-[#f8f9fa] hover:border-[#dadce0]",
        variant === "ghost" &&
          "text-[#5f6368] shadow-none hover:bg-[#f1f3f4] hover:text-[#202124]",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-sm",
        className
      )}
      {...props}
    />
  );
}
