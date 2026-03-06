"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Users,
  MessageCircle,
  Handshake,
  LayoutGrid,
  DoorOpen,
  Bot,
  Flame,
  Loader2,
  Network,
} from "lucide-react";
import type { DayRecapData } from "@/data/recap-types";

interface DayRecapNewspaperProps {
  recap: DayRecapData | undefined;
  isLoading: boolean;
  open: boolean;
  onClose: () => void;
}

export function DayRecapNewspaper({
  recap,
  isLoading,
  open,
  onClose,
}: DayRecapNewspaperProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0"
        onClick={onClose}
      />

      {/* Scroll container — clicks on empty area close the popup */}
      <div className="absolute inset-0 overflow-y-auto p-4 md:p-8" onClick={onClose}>
        <div
          className="mx-auto max-w-3xl pointer-events-auto animate-in fade-in-0 slide-in-from-bottom-4"
          onClick={(e) => e.stopPropagation()}
        >
          {isLoading && !recap ? (
            <LoadingSkeleton />
          ) : recap ? (
            <NewspaperContent recap={recap} />
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Loading skeleton ─────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-[#faf8f4] shadow-2xl overflow-hidden">
      <div className="px-6 pt-6 pb-4 text-center border-b border-border/50">
        <div className="flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">Generating your day recap...</span>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-4 bg-muted rounded w-3/4 mb-2" />
            <div className="h-3 bg-muted/60 rounded w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Full newspaper ───────────────────────────────────────────

export function NewspaperContent({
  recap,
}: {
  recap: DayRecapData;
}) {
  return (
    <div className="rounded-2xl border border-border bg-[#faf8f4] shadow-2xl overflow-hidden">
      {/* ── Masthead ── */}
      <div className="border-b-2 border-foreground/80 px-6 pt-6 pb-4 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
          {recap.date}
        </p>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground uppercase font-serif">
          The {recap.conference} Times
        </h1>
        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Day {recap.day} Edition
        </p>
        <div className="mt-3 border-t border-foreground/20 pt-3">
          <p className="text-sm md:text-base font-medium italic text-foreground/80">
            &ldquo;{recap.tagline}&rdquo;
          </p>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-border/50">
        <StatCell icon={<Users className="h-3.5 w-3.5" />} value={recap.stats.attendees} label="Attendees" />
        <StatCell icon={<MessageCircle className="h-3.5 w-3.5" />} value={recap.stats.messages} label="Messages" />
        <StatCell icon={<Handshake className="h-3.5 w-3.5" />} value={recap.stats.connections} label="Connections" />
        <StatCell icon={<LayoutGrid className="h-3.5 w-3.5" />} value={recap.stats.sessions} label="Sessions" />
        <StatCell icon={<DoorOpen className="h-3.5 w-3.5" />} value={recap.stats.breakoutRooms} label="Rooms" />
        <StatCell icon={<Bot className="h-3.5 w-3.5" />} value={recap.stats.siaCommands} label="@sia" />
      </div>

      <div className="p-6 space-y-8">
        {/* ── Energy Curve ── }
        {recap.energyCurve.length > 0 && (
          <section>
            <SectionTitle>Energy Pulse</SectionTitle>
            <div className="flex items-end gap-1 h-24 mt-3">
              {recap.energyCurve.map((point) => (
                <div key={point.time} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary/70 transition-all min-h-[2px]"
                    style={{ height: `${Math.max(point.level, 2)}%` }}
                  />
                  <span className="text-[8px] text-muted-foreground leading-none">
                    {point.time.replace(":00", "")}
                  </span>
                </div>
              ))}
            </div>
            {recap.energyCurve.some((p) => p.label) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recap.energyCurve
                  .filter((p) => p.label && p.level > 30)
                  .map((p) => (
                    <span
                      key={p.time}
                      className="text-[10px] rounded-full bg-primary/5 border border-primary/10 px-2 py-0.5 text-primary/70"
                    >
                      {p.time.replace(":00", "h")} — {p.label}
                    </span>
                  ))}
              </div>
            )}
          </section>
        )} */}

        {/* ── Headlines ── */}
        {recap.headlines.length > 0 && (
          <section>
            <SectionTitle>Headlines</SectionTitle>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {recap.headlines.map((h) => (
                <div
                  key={h.session}
                  className="rounded-xl border border-border bg-white p-4 transition-colors hover:border-primary/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-foreground leading-snug">
                      {h.headline}
                    </h3>
                    {h.hot && (
                      <Flame className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {h.summary}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{h.room}</span>
                    {h.messages > 0 && (
                      <span className="flex items-center gap-0.5">
                        <MessageCircle className="h-2.5 w-2.5" /> {h.messages}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Word Cloud ── */}
        {recap.wordCloud.length > 0 && (
          <section>
            <SectionTitle>Word Cloud</SectionTitle>
            <div className="mt-3 flex flex-wrap gap-2 justify-center">
              {recap.wordCloud.map((w) => (
                <span
                  key={w.word}
                  className={`inline-block rounded-full px-3 py-1 font-medium transition-colors ${
                    w.type === "trending"
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : w.type === "unique"
                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}
                  style={{ fontSize: `${Math.max(10, 8 + w.weight * 1.5)}px` }}
                >
                  {w.word}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Quotes + Mysteries (side by side on md+) ── */}
        {(recap.topQuotes.length > 0 || recap.mysteries.length > 0) && (
          <div className="grid gap-6 md:grid-cols-2">
            {recap.topQuotes.length > 0 && (
              <section>
                <SectionTitle>Quoteboard</SectionTitle>
                <div className="mt-3 space-y-3">
                  {recap.topQuotes.map((q, i) => (
                    <blockquote
                      key={i}
                      className="rounded-xl border-l-2 border-primary/30 bg-white p-3 pl-4"
                    >
                      <p className="text-xs text-foreground italic leading-relaxed">
                        &ldquo;{q.text}&rdquo;
                      </p>
                      <cite className="mt-1.5 block text-[10px] text-muted-foreground not-italic">
                        — {q.author}
                      </cite>
                    </blockquote>
                  ))}
                </div>
              </section>
            )}

            {recap.mysteries.length > 0 && (
              <section>
                <SectionTitle>Parking Lot</SectionTitle>
                <div className="mt-3 space-y-2">
                  {recap.mysteries.map((m, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-border bg-white p-3 text-xs text-foreground/80 leading-relaxed"
                    >
                      {m}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ── Mind Map ── */}
        {recap.mindMap && recap.mindMap.nodes.length > 0 && (
          <section>
            <SectionTitle>Most Active Mind Map</SectionTitle>
            <div className="mt-3 rounded-xl border border-border bg-white p-4">
              <div className="flex items-center gap-2 mb-3">
                <Network className="h-4 w-4 text-primary/60" />
                <span className="text-xs font-semibold text-foreground">{recap.mindMap.groupName}</span>
                <span className="text-[10px] text-muted-foreground">{recap.mindMap.nodeCount} nodes</span>
              </div>
              <MindMapTree nodes={recap.mindMap.nodes} />
            </div>
          </section>
        )}

        {/* ── Awards ── */}
        {recap.awards.length > 0 && (
          <section>
            <SectionTitle>Day {recap.day} Awards</SectionTitle>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {recap.awards.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-border bg-white p-3"
                >
                  <span className="text-xl leading-none mt-0.5">{a.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">{a.title}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground leading-relaxed">
                      {a.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Trending ── */}
        {recap.trending.length > 0 && (
          <section>
            <SectionTitle>Trending</SectionTitle>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {recap.trending.slice(0, 12).map((t) => (
                <span
                  key={t.word}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground/70 border border-border"
                >
                  {t.word}{" "}
                  <span className="text-muted-foreground">×{t.count}</span>
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-border/50 px-6 py-3 text-center">
        <p className="text-[9px] text-muted-foreground tracking-wide">
          AI-GENERATED RECAP • {recap.generatedAt ? new Date(recap.generatedAt).toLocaleString() : ""}
        </p>
      </div>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────

function StatCell({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 bg-[#faf8f4] py-3 px-2">
      <div className="text-muted-foreground">{icon}</div>
      <span className="text-sm font-bold text-foreground">{value}</span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-xs font-bold uppercase tracking-wider text-foreground/60">
        {children}
      </h2>
      <div className="flex-1 border-t border-foreground/10" />
    </div>
  );
}

// ─── Mind Map Tree ────────────────────────────────────────────

interface MindMapNode {
  id: string;
  parentId: string | null;
  label: string;
}

function MindMapTree({ nodes }: { nodes: MindMapNode[] }) {
  const childrenMap = new Map<string | null, MindMapNode[]>();
  for (const n of nodes) {
    const key = n.parentId;
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(n);
  }

  // Find roots (parentId is null or parentId not in node set)
  const nodeIds = new Set(nodes.map((n) => n.id));
  const roots = nodes.filter(
    (n) => n.parentId === null || !nodeIds.has(n.parentId)
  );

  function renderBranch(node: MindMapNode, depth: number): React.ReactNode {
    const children = childrenMap.get(node.id) ?? [];
    return (
      <div key={node.id} className={depth > 0 ? "ml-4 border-l border-border/50 pl-3" : ""}>
        <div className="flex items-center gap-1.5 py-0.5">
          <div
            className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
              depth === 0
                ? "bg-primary"
                : children.length > 0
                ? "bg-primary/50"
                : "bg-muted-foreground/30"
            }`}
          />
          <span
            className={`text-xs leading-snug ${
              depth === 0 ? "font-semibold text-foreground" : "text-foreground/70"
            }`}
          >
            {node.label}
          </span>
        </div>
        {children.map((child) => renderBranch(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {roots.map((root) => renderBranch(root, 0))}
    </div>
  );
}
