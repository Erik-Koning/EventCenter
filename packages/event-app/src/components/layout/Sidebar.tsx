"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Users,
  Mic2,
  LayoutList,
  CalendarCheck,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@common/lib/utils";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/speakers", label: "Speakers", icon: Mic2 },
  { href: "/sessions", label: "Sessions", icon: LayoutList },
  { href: "/attendees", label: "Attendees", icon: Users },
  { href: "/my-calendar", label: "My Calendar", icon: CalendarCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 rounded-lg border border-border bg-white p-2 shadow-sm lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-white transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Close button (mobile) */}
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Logo / Event Name */}
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Image src="/scotia_logo.png" alt="Event Logo" width={32} height={32} />
            </div>
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-foreground">
                Executive Offsite
              </h1>
              <p className="text-[11px] text-muted-foreground">2026</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-border" />

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "bg-primary/[0.06] text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] flex-shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                  strokeWidth={isActive ? 2 : 1.5}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4">
          <p className="text-[11px] text-muted-foreground">
            The Ritz-Carlton, Toronto
          </p>
          <p className="text-[11px] text-muted-foreground">
            April 15–17, 2026
          </p>
        </div>
      </aside>
    </>
  );
}
