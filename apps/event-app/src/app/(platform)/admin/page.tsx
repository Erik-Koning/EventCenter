"use client";

import { useState } from "react";
import { HoverBarMenuArray } from "@common/components/ui/HoverBarMenuArray";
import { PageHeader } from "@/components/layout/PageHeader";
import { AdminEventSelector } from "@/components/admin/AdminEventSelector";
import { EventsTab } from "@/components/admin/EventsTab";
import { SessionsTab } from "@/components/admin/SessionsTab";
import { UsersTab } from "@/components/admin/UsersTab";

const TAB_NAMES = ["Events", "Sessions", "Users"];
const TAB_COMPONENTS = [EventsTab, SessionsTab, UsersTab];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState(0);
  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div>
      <PageHeader
        title="Admin"
        subtitle="Manage events, sessions, and users"
        action={<AdminEventSelector />}
      />

      <HoverBarMenuArray
        menuBarItemTitles={TAB_NAMES}
        defaultTabIndex={0}
        onClick={(_e: any, index: number) => setActiveTab(index)}
        className="mb-6"
      />

      <ActiveComponent />
    </div>
  );
}
