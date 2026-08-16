import { Link, useLocation, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Bell, ChevronDown, ChevronRight, LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogoLink } from "./Logo";
import { useAuthUser, signOut, useShipmentBreadcrumb } from "@/lib/auth-hooks";
import { GlobalSearch } from "@/components/admin/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { brand } from "@/lib/brand";

function pageTitle(path: string): string {
  if (path === "/dashboard" || path === "/") return "Dashboard";
  if (path === "/live-map") return "Live map";
  if (path.startsWith("/shipments/new")) return "New shipment";
  if (path.startsWith("/shipments/scan")) return "Scan barcode";
  if (path.startsWith("/shipments")) return "Shipments";
  if (path.startsWith("/routes")) return "Routes";
  if (path.startsWith("/api-keys")) return "API keys";
  if (path.startsWith("/settings")) return "Settings";
  return brand.adminTitle;
}

export function Header({ mobileNav }: { mobileNav?: ReactNode }) {
  const navigate = useNavigate();
  const { pathname: path } = useLocation();
  const title = pageTitle(path);

  const meQ = useAuthUser();
  const user = meQ.data;
  const initial = (user?.full_name?.[0] ?? user?.email?.[0] ?? "A").toUpperCase();
  const shipmentMatch = path.match(/^\/shipments\/([^/]+)$/);
  const shipmentId = shipmentMatch?.[1] ?? null;
  const isShipmentDetail = !!shipmentId && shipmentId !== "new" && shipmentId !== "scan";

  const shipmentQ = useShipmentBreadcrumb(isShipmentDetail ? shipmentId : null);
  const trackingCrumb = isShipmentDetail ? shipmentQ.data?.tracking_code ?? "Shipment details" : null;

  async function onSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <header className="apple-glass z-30 flex shrink-0 items-center justify-between border-b border-border/50 px-4 py-3 shadow-2xs lg:px-8">
      <div className="flex min-w-0 items-center gap-4">
        {mobileNav}
        <LogoLink />
        <div className="hidden items-center gap-2 border-l border-border pl-4 text-xs font-medium text-muted-foreground md:flex">
          <span className="font-semibold text-foreground">{title}</span>
          {trackingCrumb && (
            <>
              <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/60" />
              <span className="tracking-code font-bold">{trackingCrumb}</span>
            </>
          )}
        </div>
      </div>
      <div className="mx-6 hidden max-w-md flex-1 sm:flex">
        <GlobalSearch />
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <ThemeToggle className="hidden sm:inline-flex" />
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card text-foreground transition hover:bg-accent"
          title="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full bg-info" />
        </button>
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex max-w-[200px] items-center gap-2.5 rounded-xl p-1 pr-2 transition hover:bg-accent"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-2xs">
                {initial}
              </div>
              <div className="hidden text-left lg:block">
                <div className="text-xs leading-none font-bold text-foreground">
                  {user?.full_name ?? user?.email ?? "Admin"}
                </div>
                <div className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                  {user?.tenant?.name ?? "Operations"}
                </div>
              </div>
              <ChevronDown className="ml-1 h-2.5 w-2.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="truncate font-normal">
              <div className="text-sm font-medium text-foreground">{user?.full_name ?? "Admin"}</div>
              <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void onSignOut()} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ThemeToggle className="sm:hidden" />
      </div>
    </header>
  );
}
