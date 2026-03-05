"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Users,
  Mic2,
  LayoutList,
  Network,
  Menu,
  X,
  LogOut,
  Shield,
  ChevronDown,
  CalendarX2,
  CalendarPlus,
} from "lucide-react";
import LogoutButton from "@/components/auth/logout-button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@common/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { useEventStore, type EventData } from "@/lib/stores/eventStore";
import { EventSwitchModal } from "./EventSwitchModal";
import { format } from "date-fns";

const NAV_ITEMS = [
  { href: "/agenda", label: "Agenda", icon: Calendar },
  { href: "/speakers", label: "Speakers", icon: Mic2 },
  { href: "/sessions", label: "Sessions", icon: LayoutList },
  { href: "/attendees", label: "Attendees", icon: Users },
  { href: "/networking", label: "Networking", icon: Network },
];

function getInitials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatEventDates(startDate: string, endDate: string): string {
  const start = new Date(startDate + "T12:00:00");
  const end = new Date(endDate + "T12:00:00");
  if (startDate === endDate) {
    return format(start, "MMM d, yyyy");
  }
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, "MMM d")}–${format(end, "d, yyyy")}`;
  }
  return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
}

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [eventDropdownOpen, setEventDropdownOpen] = useState(false);
  const [availableEvents, setAvailableEvents] = useState<EventData[]>([]);
  const [joiningEventId, setJoiningEventId] = useState<string | null>(null);
  const { data: session } = authClient.useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  const currentEvent = useEventStore((s) => s.currentEvent);
  const userEvents = useEventStore((s) => s.userEvents);
  const fetchUserEvents = useEventStore((s) => s.fetchUserEvents);
  const switchEvent = useEventStore((s) => s.switchEvent);

  useEffect(() => {
    fetchUserEvents();
  }, [fetchUserEvents]);

  // Fetch all available events (+-24 months)
  useEffect(() => {
    fetch("/api/events/available")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAvailableEvents)
      .catch(() => {});
  }, []);

  const joinEvent = useCallback(async (eventId: string) => {
    setJoiningEventId(eventId);
    try {
      const res = await fetch("/api/events/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });
      if (res.ok) {
        await fetchUserEvents();
        setEventDropdownOpen(false);
      }
    } finally {
      setJoiningEventId(null);
    }
  }, [fetchUserEvents]);

  const joinedEventIds = new Set(userEvents.map((e) => e.id));
  const unjoinedEvents = availableEvents.filter((e) => !joinedEventIds.has(e.id));
  const hasMultipleEvents = userEvents.length > 1 || unjoinedEvents.length > 0;

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
            <Image src="/scotia_logo.png" alt="Event Logo" width={32} height={32} unoptimized className="h-8 w-8 rounded-lg" />
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-foreground">
                {currentEvent?.title ?? "Event Center"}
              </h1>
              <p className="text-[11px] text-muted-foreground">
                {currentEvent
                  ? formatEventDates(currentEvent.startDate, currentEvent.endDate)
                  : ""}
              </p>
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

          {/* Admin nav */}
          {isAdmin && (
            <>
              <div className="mx-1 my-2 border-t border-border" />
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  pathname.startsWith("/admin")
                    ? "bg-primary/[0.06] text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Shield
                  className={cn(
                    "h-[18px] w-[18px] flex-shrink-0",
                    pathname.startsWith("/admin") ? "text-primary" : "text-muted-foreground"
                  )}
                  strokeWidth={pathname.startsWith("/admin") ? 2 : 1.5}
                />
                Admin
              </Link>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3">
          {/* Event selector */}
          <div className="relative mb-3">
            <button
              onClick={() => setEventDropdownOpen(!eventDropdownOpen)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
            >
              {currentEvent ? (
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-foreground truncate">
                    {currentEvent.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatEventDates(currentEvent.startDate, currentEvent.endDate)}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CalendarX2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <p className="text-[11px] text-muted-foreground">No active event</p>
                </div>
              )}
              <ChevronDown className={cn("h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform", eventDropdownOpen && "rotate-180")} />
            </button>
            {eventDropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-white shadow-md">
                {/* Joined events */}
                {userEvents
                  .filter((e) => e.id !== currentEvent?.id)
                  .map((event) => (
                    <button
                      key={event.id}
                      onClick={() => {
                        switchEvent(event.id);
                        setEventDropdownOpen(false);
                      }}
                      className="flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-muted"
                    >
                      <p className="text-[11px] font-medium text-foreground">
                        {event.title}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatEventDates(event.startDate, event.endDate)}
                      </p>
                    </button>
                  ))}
                {/* Available events to join */}
                {unjoinedEvents.length > 0 && (
                  <>
                    {userEvents.length > 0 && (
                      <div className="mx-2 border-t border-border" />
                    )}
                    <div className="px-3 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        Available Events
                      </p>
                    </div>
                    {unjoinedEvents.map((event) => (
                      <button
                        key={event.id}
                        disabled={joiningEventId === event.id}
                        onClick={() => joinEvent(event.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        <CalendarPlus className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-medium text-foreground truncate">
                            {event.title}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatEventDates(event.startDate, event.endDate)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {userEvents.filter((e) => e.id !== currentEvent?.id).length === 0 &&
                  unjoinedEvents.length === 0 && (
                    <p className="px-3 py-2 text-[11px] text-muted-foreground">
                      No other events available
                    </p>
                  )}
              </div>
            )}
          </div>

          {/* Logout */}
          <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <LogoutButton />
          </div>

          {/* User info */}
          {session?.user && (
            <>
              <div className="mx-1 my-2 border-t border-border" />
              <Link
                href="/account"
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {getInitials(session.user.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {session.user.name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {session.user.email}
                  </p>
                </div>
              </Link>
            </>
          )}
        </div>
      </aside>

      {/* Event switch modal */}
      <EventSwitchModal />
    </>
  );
}
