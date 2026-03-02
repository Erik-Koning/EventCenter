"use client";

import { Sidebar } from "./Sidebar";
import { ChatWidget } from "@/components/chat/ChatWidget";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-6 py-8 pt-16 lg:pt-8">
          {children}
        </div>
      </main>
      <ChatWidget />
    </div>
  );
}
