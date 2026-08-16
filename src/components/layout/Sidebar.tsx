import { Link, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { navSections, type NavItem } from "./nav";
import { useShipmentCount } from "@/lib/auth-hooks";

function isActivePath(path: string, to: string) {
  if (path === to) return true;
  if (to === "/dashboard") return path === "/dashboard" || path === "/";
  return to !== "/dashboard" && path.startsWith(`${to}`);
}

function NavLink({
  item,
  path,
  onNavigate,
  trailing,
}: {
  item: NavItem;
  path: string;
  onNavigate?: () => void;
  trailing?: ReactNode;
}) {
  const active = isActivePath(path, item.to);
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn("nav-link", active && "nav-link--active")}
    >
      <Icon className={cn("nav-link__icon h-4 w-4 shrink-0", active && "nav-link__icon")} />
      <span className="truncate">{item.label}</span>
      {trailing}
    </Link>
  );
}

function NavBody({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname: path } = useLocation();
  const shipmentsQ = useShipmentCount();
  const shipmentCount = shipmentsQ.data?.total;

  return (
    <div className="space-y-5">
      {navSections.map((section) => (
        <div key={section.id} className="space-y-1">
          <div className="nav-section-label">{section.group}</div>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              let trailing: ReactNode = null;
              if (item.to === "/shipments" && shipmentCount != null) {
                trailing = <span className="nav-badge">{shipmentCount}</span>;
              }
              if (item.to === "/live-map") {
                trailing = <span className="nav-badge nav-badge--live">Active</span>;
              }
              return (
                <li key={item.to}>
                  <NavLink item={item} path={path} onNavigate={onNavigate} trailing={trailing} />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex-1 overflow-y-auto p-4">
        <NavBody />
      </div>
    </aside>
  );
}

export function MobileNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="p-4">
      <NavBody onNavigate={onNavigate} />
    </div>
  );
}
