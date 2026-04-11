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
          "bg-[#6b9b7a] text-white hover:bg-[#598a68] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6b9b7a]",
        variant === "secondary" &&
          "border border-[#c5dccf] bg-[#faf9f5] text-[#2a382f] shadow-none hover:bg-[#f4f8f5] hover:border-[#b8d4c2]",
        variant === "ghost" &&
          "text-[#5c6e62] shadow-none hover:bg-[#eaf2ec] hover:text-[#2a382f]",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-sm",
        className
      )}
      {...props}
    />
  );
}
