"use client";

import { useUIStore } from "@/lib/stores/uiStore";
import { useUserStore } from "@/lib/stores/userStore";
import { TooltipWrapper } from "@common/components/ui/TooltipWrapper";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  LogOut,
  Settings,
  Home,
  Sparkles,
  TrendingUp,
  Users,
  PenLine,
  History,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface NavItem {
  href: string;
  icon: React.ReactNode;
  label: string;
}

interface SideMenuProps {
  isFixed?: boolean;
}

const SideMenu: React.FC<SideMenuProps> = ({ isFixed = true }) => {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  const { sideMenuOpen, setSideMenuOpen } = useUIStore();
  const { user, signOut, fetchUser, isLoading } = useUserStore();

  useEffect(() => {
    setMounted(true);
    fetchUser();
  }, [fetchUser]);

  const iconSize = 20;

  const mainNavItems: NavItem[] = [
    { href: "/update", icon: <PenLine size={iconSize} />, label: "New Update" },
    { href: "/home", icon: <Home size={iconSize} />, label: "Home" },
    { href: "/dashboard", icon: <BarChart3 size={iconSize} />, label: "Dashboard" },
    { href: "/follow-ups", icon: <Bell size={iconSize} />, label: "Follow-ups" },
    { href: "/calendar", icon: <Calendar size={iconSize} />, label: "Calendar" },
    { href: "/stats", icon: <TrendingUp size={iconSize} />, label: "My Stats" },
    { href: "/update/history", icon: <History size={iconSize} />, label: "Update History" },
    ...(user?.activeTeamId
      ? [{ href: `/admin/teams/${user.activeTeamId}/stats`, icon: <Users size={iconSize} />, label: "Team Stats" }]
      : []),
    { href: "/admin/teams", icon: <Shield size={iconSize} />, label: "Admin Teams" },
  ];

  const bottomNavItems: NavItem[] = [
    { href: "/support", icon: <HelpCircle size={iconSize} />, label: "Support" },
    { href: "/dashboard/setting", icon: <Settings size={iconSize} />, label: "Settings" },
  ];

  const isActive = (href: string) => {
    if (href === "/home") {
      return pathname === "/home";
    }
    return pathname.startsWith(href);
  };

  const NavLink = ({ item }: { item: NavItem }) => (
    <TooltipWrapper
      tooltipText={item.label}
      side="right"
      sideOffset={10}
      disabled={sideMenuOpen}
      classNameChildren="w-full"
      className="backdrop-blur-[2.5px] bg-white/65"
    >
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer",
          "hover:bg-primary/10 text-foreground/70 hover:text-primary",
          isActive(item.href) && "bg-primary/15 text-primary font-medium backdrop-blur-sm",
          !sideMenuOpen && "justify-center"
        )}
      >
        <span className="shrink-0">{item.icon}</span>
        {sideMenuOpen && (
          <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>
        )}
      </Link>
    </TooltipWrapper>
  );

  const handleSignOut = async () => {
    await signOut();
  };

  const handleExpandClick = useCallback(() => {
    setSideMenuOpen(!sideMenuOpen);
  }, [sideMenuOpen, setSideMenuOpen]);

  if (!mounted) return null;

  return (
    <>
      {/* Side menu - always visible, expands/collapses */}
      <aside
        className={cn(
          isFixed ? "fixed" : "absolute",
          "left-0 top-0 z-[45] flex flex-col h-full",
          "bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl",
          "border-r border-white/30 dark:border-slate-700/30",
          "transition-all duration-300 ease-out",
          sideMenuOpen ? "w-[220px]" : "w-[60px]"
        )}
      >
        {/* Logo/Brand */}
        <div className="p-4 border-b border-white/20 dark:border-slate-700/20">
          <Link href="/home" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm shrink-0">
              <Sparkles size={18} className="text-primary-foreground" />
            </div>
            {sideMenuOpen && (
              <span className="font-semibold text-foreground">Clio</span>
            )}
          </Link>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {mainNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-3 border-t border-white/20 dark:border-slate-700/20" />

        {/* Bottom Navigation */}
        <nav className="p-3 space-y-1">
          {bottomNavItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}

          {/* Sign Out */}
          <TooltipWrapper
            tooltipText="Sign Out"
            side="right"
            sideOffset={10}
            disabled={sideMenuOpen}
            classNameChildren="w-full"
          >
            <button
              onClick={handleSignOut}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 w-full cursor-pointer",
                "hover:bg-destructive/10 text-foreground/70 hover:text-destructive",
                !sideMenuOpen && "justify-center"
              )}
            >
              <LogOut size={iconSize} className="shrink-0" />
              {sideMenuOpen && (
                <span className="text-sm font-medium whitespace-nowrap">Sign Out</span>
              )}
            </button>
          </TooltipWrapper>
        </nav>

        {/* User Profile */}
        <div className="p-3 border-t border-white/20 dark:border-slate-700/20">
          <div
            className={cn(
              "flex items-center gap-3 p-2 rounded-lg",
              "bg-white/40 dark:bg-slate-800/40 backdrop-blur-sm",
              !sideMenuOpen && "justify-center"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground text-sm font-semibold shrink-0 shadow-sm">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            {sideMenuOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {isLoading ? "Loading..." : user?.name || "User"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user?.email || ""}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Expand/Collapse Button - inside sidebar at bottom */}
        <div className="p-3 border-t border-white/20 dark:border-slate-700/20 flex justify-center">
          <TooltipWrapper
            tooltipText={sideMenuOpen ? "Collapse menu" : "Expand menu"}
            side="right"
            sideOffset={10}
            disabled={sideMenuOpen}
          >
            <button
              onClick={handleExpandClick}
              className={cn(
                "w-8 h-8 rounded-full cursor-pointer",
                "bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/30 dark:border-slate-700/30",
                "flex items-center justify-center",
                "text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-white/90 dark:hover:bg-slate-800/90",
                "shadow-md transition-all duration-200"
              )}
            >
              {sideMenuOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </TooltipWrapper>
        </div>
      </aside>
    </>
  );
};

export default SideMenu;
