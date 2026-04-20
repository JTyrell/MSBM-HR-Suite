import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, MapPin, Clock, DollarSign, Users, Settings, LogOut, Map,
  ChevronLeft, Menu, Shield, Calendar, MessageSquare, BarChart3, CalendarClock, Umbrella,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  flag?: string; // feature flag key — if set, item only shows when flag is enabled
}

export default function AppSidebar() {
  const { profile, isAdmin, isHR, signOut } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Feature flags
  const wfmEnabled = useFeatureFlag("enabled_workforce_mgmt");
  const msgEnabled = useFeatureFlag("enabled_messaging");
  const rptEnabled = useFeatureFlag("enabled_reporting");

  const flagLookup: Record<string, boolean> = {
    enabled_workforce_mgmt: wfmEnabled,
    enabled_messaging: msgEnabled,
    enabled_reporting: rptEnabled,
  };

  // ── Admin/HR Navigation ─────────────────────────────────────
  const adminNavItems: NavItem[] = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Attendance", icon: Clock, href: "/attendance" },
    { label: "Geofences", icon: Map, href: "/geofences" },
    { label: "Employees", icon: Users, href: "/employees" },
    { label: "Payroll", icon: DollarSign, href: "/payroll" },
    // Workforce Management (flag-gated)
    { label: "Schedule", icon: CalendarClock, href: "/schedule", flag: "enabled_workforce_mgmt" },
    { label: "Time Sheets", icon: Calendar, href: "/timesheets", flag: "enabled_workforce_mgmt" },
    { label: "Leave", icon: Umbrella, href: "/leave", flag: "enabled_workforce_mgmt" },
    // Messaging (flag-gated)
    { label: "Messages", icon: MessageSquare, href: "/messages", flag: "enabled_messaging" },
    // Reporting (flag-gated)
    { label: "Reports", icon: BarChart3, href: "/reports", flag: "enabled_reporting" },
    // Always visible
    { label: "CRM Panel", icon: Shield, href: "/crm" },
    { label: "Settings", icon: Settings, href: "/settings" },
  ];

  // ── Employee Navigation ─────────────────────────────────────
  const employeeNavItems: NavItem[] = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Clock In/Out", icon: MapPin, href: "/clock" },
    { label: "My Attendance", icon: Clock, href: "/attendance" },
    { label: "Pay Stubs", icon: DollarSign, href: "/pay-stubs" },
    // Workforce Management (flag-gated)
    { label: "My Schedule", icon: CalendarClock, href: "/schedule", flag: "enabled_workforce_mgmt" },
    { label: "Leave", icon: Umbrella, href: "/leave", flag: "enabled_workforce_mgmt" },
    // Messaging (flag-gated)
    { label: "Messages", icon: MessageSquare, href: "/messages", flag: "enabled_messaging" },
    // Always visible
    { label: "Settings", icon: Settings, href: "/settings" },
  ];

  const rawNav = isAdmin || isHR ? adminNavItems : employeeNavItems;

  // Filter by feature flags
  const nav = rawNav.filter(item => {
    if (!item.flag) return true;
    return flagLookup[item.flag] ?? false;
  });

  const initials = `${(profile?.first_name?.[0] || "").toUpperCase()}${(profile?.last_name?.[0] || "").toUpperCase()}` || "U";

  return (
    <>
      {/* Mobile toggle */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden rounded-lg bg-card p-2 shadow-md border"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className={cn("flex items-center h-16 px-4 border-b border-sidebar-border", collapsed && "justify-center")}>
          {!collapsed && (
            <h1 className="font-display text-lg font-bold tracking-tight truncate">
              MSBM-HR <span className="text-primary">Suite</span>
            </h1>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex ml-auto p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {nav.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={cn("border-t border-sidebar-border p-3", collapsed && "flex flex-col items-center")}>
          <div className={cn("flex items-center gap-3 mb-3", collapsed && "flex-col")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{profile?.first_name} {profile?.last_name}</p>
                <p className="text-xs text-sidebar-foreground/50 truncate">{profile?.email}</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "default"}
            className="w-full text-sidebar-foreground/60 hover:text-destructive"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </aside>
    </>
  );
}
