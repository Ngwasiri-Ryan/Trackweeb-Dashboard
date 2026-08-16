import { Package, Plane, Ship, Train, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

const MODE_CONFIG: Record<string, { Icon: typeof Truck; className: string }> = {
  road: { Icon: Truck, className: "mode-icon--road" },
  air: { Icon: Plane, className: "mode-icon--air" },
  sea: { Icon: Ship, className: "mode-icon--sea" },
  rail: { Icon: Train, className: "mode-icon--rail" },
};

export function ModeIcon({
  code,
  className,
  size = "sm",
}: {
  code: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const config = MODE_CONFIG[code] ?? { Icon: Package, className: "mode-icon--road" };
  const { Icon } = config;
  const sizeClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return <Icon className={cn(sizeClass, "shrink-0", config.className, className)} />;
}
