import { cn } from "@/utils/cn";

export interface AvatarProps {
  name: string;
  size?: "sm" | "md";
  className?: string;
}

export function Avatar({ name, size = "md", className }: AvatarProps) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full bg-accent-soft font-display font-medium text-accent",
        size === "md" ? "size-8 text-sm" : "size-6 text-xs",
        className,
      )}
    >
      {initial || "?"}
    </span>
  );
}
