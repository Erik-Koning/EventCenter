"use client";

import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { NoEventsView } from "./NoEventsView";
import { useEventStore } from "@/lib/stores/eventStore";
import { authClient } from "@/lib/auth-client";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentEvent = useEventStore((s) => s.currentEvent);
  const userEvents = useEventStore((s) => s.userEvents);
  const isLoading = useEventStore((s) => s.isLoading);
  const { data: session } = authClient.useSession();
  const isAdmin = (session?.user as any)?.role === "admin";

  const isAdminPage = pathname.startsWith("/admin");
  const needsNoEventsGuard =
    !isLoading && userEvents.length === 0 && !currentEvent && !isAdmin && !isAdminPage;

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-6 py-8 pt-16 lg:pt-8">
          {isLoading ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : needsNoEventsGuard ? (
            <NoEventsView />
          ) : (
            children
          )}
        </div>
      </main>
      <ChatWidget />
    </div>
  );
}
