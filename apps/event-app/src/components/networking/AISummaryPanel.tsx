"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useNetworkingStore, type Insight } from "@/lib/stores/networkingStore";

interface SummaryData {
  summary: string;
  topWords: string[];
  recentExcerpts: { author: string; preview: string }[];
  messageCount: number;
}

function InsightBadge({ insight }: { insight: Insight }) {
  const [showDesc, setShowDesc] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowDesc((v) => !v)}
        className="inline-flex rounded-full bg-primary/[0.06] px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/[0.12]"
      >
        {insight.title}
      </button>
      {showDesc && (
        <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg border border-border bg-white p-2.5 shadow-md">
          <p className="text-[11px] leading-relaxed text-foreground">
            {insight.description}
          </p>
        </div>
      )}
    </div>
  );
}

export function AISummaryPanel() {
  const selectedGroupId = useNetworkingStore((s) => s.selectedGroupId);
  const isMember = useNetworkingStore((s) => s.isMember);
  const messages = useNetworkingStore((s) => s.messages);
  const groups = useNetworkingStore((s) => s.groups);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);

  const insights =
    groups.find((g) => g.id === selectedGroupId)?.insights ?? [];

  // Fetch summary when messages change significantly
  useEffect(() => {
    if (!selectedGroupId || !isMember) return;

    fetch(`/api/networking/groups/${selectedGroupId}/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSummaryData(data);
      })
      .catch(() => {});
  }, [selectedGroupId, isMember, messages.length]);

  if (!isMember) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Join the group to see insights
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Insights</h4>
      </div>

      {/* Insight labels */}
      <div className="flex flex-wrap gap-1.5 min-h-[80px] overflow-y-auto">
        {insights.length > 0 ? (
          insights.map((insight, i) => (
            <InsightBadge key={`${insight.title}-${i}`} insight={insight} />
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            Insights will appear as the conversation grows.
          </p>
        )}
      </div>

      {/* AI Summary text */}
      {summaryData && (
        <div className="rounded-lg bg-secondary/50 px-3 py-2">
          <p className="text-xs text-foreground/70">{summaryData.summary}</p>
        </div>
      )}
    </div>
  );
}
