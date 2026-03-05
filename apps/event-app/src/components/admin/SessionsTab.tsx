"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@common/components/ui/Table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@common/components/ui/dialog";
import { HoverCardClickable } from "@common/components/inputs/HoverCardClickable";
import { Badge } from "@common/components/ui/badge";
import { Plus, MoreVertical, Pencil, Trash2, FileText, Loader2, Download, Send, CheckCheck } from "lucide-react";
import { NewspaperContent } from "@/components/agenda/DayRecapNewspaper";
import type { DayRecapData } from "@/data/recap-types";

interface Speaker {
  id: string;
  name: string;
}

interface SessionSpeaker {
  user: Speaker;
}

interface Session {
  id: string;
  eventId: string | null;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  location: string | null;
  track: string | null;
  tags: string[];
  sessionSpeakers: SessionSpeaker[];
}

interface EventOption {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
}

interface Recipient {
  id: string;
  name: string;
  userEmail: string | null;
}

const TRACKS = ["Leadership", "Technology", "Strategy", "Innovation", "Culture"] as const;

const emptyForm = {
  eventId: "",
  title: "",
  description: "",
  date: "",
  startTime: "",
  endTime: "",
  location: "",
  track: "" as string,
  speakerIds: [] as string[],
};

export function SessionsTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Session | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterEventId, setFilterEventId] = useState("");

  // Report dialog state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportEventId, setReportEventId] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [recapData, setRecapData] = useState<DayRecapData | null>(null);
  const [recapStatus, setRecapStatus] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [emailSentCount, setEmailSentCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [sessRes, evRes, spRes] = await Promise.all([
      fetch(`/api/admin/sessions${filterEventId ? `?eventId=${filterEventId}` : ""}`),
      fetch("/api/admin/events"),
      fetch("/api/admin/speakers"),
    ]);
    if (sessRes.ok) setSessions(await sessRes.json());
    if (evRes.ok) setEvents(await evRes.json());
    if (spRes.ok) setSpeakers(await spRes.json());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filterEventId]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s: Session) => {
    setEditing(s);
    setForm({
      eventId: s.eventId ?? "",
      title: s.title,
      description: s.description ?? "",
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location ?? "",
      track: s.track ?? "",
      speakerIds: s.sessionSpeakers.map((ss) => ss.user.id),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const url = editing ? `/api/admin/sessions/${editing.id}` : "/api/admin/sessions";
    const method = editing ? "PUT" : "POST";
    const payload = {
      ...form,
      eventId: form.eventId || undefined,
      track: form.track || undefined,
    };
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setDialogOpen(false);
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this session?")) return;
    const res = await fetch(`/api/admin/sessions/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  const toggleSpeaker = (id: string) => {
    setForm((f) => ({
      ...f,
      speakerIds: f.speakerIds.includes(id)
        ? f.speakerIds.filter((s) => s !== id)
        : [...f.speakerIds, id],
    }));
  };

  // ─── Report dialog logic ────────────────────────────────────
  const openReport = () => {
    setReportEventId("");
    setReportDate("");
    setRecapData(null);
    setRecapStatus("idle");
    setRecipients([]);
    setSelectedRecipients(new Set());
    setEmailStatus("idle");
    setEmailSentCount(0);
    setReportOpen(true);
  };

  const selectedEvent = events.find((e) => e.id === reportEventId);

  const pollRecap = useCallback((eventId: string, date: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/recap?date=${date}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "ready") {
          setRecapData(data.recap);
          setRecapStatus("ready");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // keep polling
      }
    }, 2000);
  }, []);

  const handleGenerate = async () => {
    if (!reportEventId || !reportDate) return;
    setRecapStatus("generating");
    setRecapData(null);

    try {
      const res = await fetch(`/api/events/${reportEventId}/recap`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: reportDate }),
      });
      const data = await res.json();

      if (data.status === "ready") {
        setRecapData(data.recap);
        setRecapStatus("ready");
      } else {
        // generating — poll for result
        pollRecap(reportEventId, reportDate);
      }
    } catch {
      setRecapStatus("error");
    }
  };

  // Fetch recipients when recap is ready
  useEffect(() => {
    if (recapStatus !== "ready") return;
    (async () => {
      const res = await fetch("/api/admin/attendees");
      if (res.ok) {
        const rows: Recipient[] = await res.json();
        setRecipients(rows.filter((r) => r.userEmail));
      }
    })();
  }, [recapStatus]);

  const toggleRecipient = (id: string) => {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllRecipients = () => {
    if (selectedRecipients.size === recipients.length) {
      setSelectedRecipients(new Set());
    } else {
      setSelectedRecipients(new Set(recipients.map((r) => r.id)));
    }
  };

  const handleSendEmail = async () => {
    if (selectedRecipients.size === 0) return;
    setEmailStatus("sending");
    try {
      const res = await fetch("/api/admin/reports/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: reportEventId,
          date: reportDate,
          recipientIds: Array.from(selectedRecipients),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEmailSentCount(data.sent);
        setEmailStatus("sent");
      } else {
        setEmailStatus("idle");
      }
    } catch {
      setEmailStatus("idle");
    }
  };

  const handleDownload = () => {
    if (!recapData) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(buildPrintHtml(recapData));
    printWindow.document.close();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Label>Filter by Event:</Label>
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={filterEventId}
            onChange={(e) => setFilterEventId(e.target.value)}
          >
            <option value="">All</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openReport} size="sm" variant="outline">
            <FileText className="mr-1 h-4 w-4" /> Generate Report
          </Button>
          <Button onClick={openCreate} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Add Session
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Track</TableHead>
              <TableHead>Speakers</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.title}</TableCell>
                <TableCell>{s.date}</TableCell>
                <TableCell>{s.startTime}–{s.endTime}</TableCell>
                <TableCell>
                  {s.track ? <Badge variant="outline">{s.track}</Badge> : "—"}
                </TableCell>
                <TableCell>
                  {s.sessionSpeakers.map((ss) => ss.user.name).join(", ") || "—"}
                </TableCell>
                <TableCell>
                  <HoverCardClickable
                    triggerJSX={
                      <div className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                    }
                    side="bottom"
                    sideOffset={4}
                    hoverDelay={300}
                    hoverExitDelay={600}
                    className="w-40 rounded-lg border border-border bg-white p-1 shadow-lg"
                  >
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                      onMouseDown={() => openEdit(s)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                      onMouseDown={() => handleDelete(s.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </HoverCardClickable>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Session Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Session" : "Create Session"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update session details." : "Fill in the session details."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="s-event">Event</Label>
              <select
                id="s-event"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.eventId}
                onChange={(e) => setForm({ ...form, eventId: e.target.value })}
              >
                <option value="">None</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-title">Title</Label>
              <Input id="s-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="s-desc">Description</Label>
              <Input id="s-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="s-date">Date</Label>
                <Input id="s-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="s-start">Start Time</Label>
                <Input id="s-start" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="s-end">End Time</Label>
                <Input id="s-end" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="s-loc">Location</Label>
                <Input id="s-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="s-track">Track</Label>
                <select
                  id="s-track"
                  className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.track}
                  onChange={(e) => setForm({ ...form, track: e.target.value })}
                >
                  <option value="">None</option>
                  {TRACKS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Speakers</Label>
              <div className="flex flex-wrap gap-2">
                {speakers.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => toggleSpeaker(sp.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      form.speakerIds.includes(sp.id)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary"
                    }`}
                  >
                    {sp.name}
                  </button>
                ))}
                {speakers.length === 0 && (
                  <span className="text-xs text-muted-foreground">No speakers available. Create speakers first.</span>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={(open) => {
        if (!open && pollRef.current) clearInterval(pollRef.current);
        setReportOpen(open);
      }}>
        <DialogContent className="sm:max-w-3xl rounded-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate Day Report</DialogTitle>
            <DialogDescription>
              Select an event and date to generate an AI-powered day recap.
            </DialogDescription>
          </DialogHeader>

          {/* Event + Date selectors */}
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="r-event">Event</Label>
              <select
                id="r-event"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={reportEventId}
                onChange={(e) => {
                  setReportEventId(e.target.value);
                  setReportDate("");
                  setRecapData(null);
                  setRecapStatus("idle");
                }}
              >
                <option value="">Select an event</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="r-date">Date</Label>
              <Input
                id="r-date"
                type="date"
                value={reportDate}
                min={selectedEvent?.startDate}
                max={selectedEvent?.endDate}
                disabled={!reportEventId}
                onChange={(e) => {
                  setReportDate(e.target.value);
                  setRecapData(null);
                  setRecapStatus("idle");
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerate}
              disabled={!reportEventId || !reportDate || recapStatus === "generating"}
              size="sm"
            >
              {recapStatus === "generating" ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate"
              )}
            </Button>
            {recapData && (
              <Button onClick={handleDownload} size="sm" variant="outline">
                <Download className="mr-1 h-4 w-4" /> Download / Print
              </Button>
            )}
          </div>

          {/* Error */}
          {recapStatus === "error" && (
            <p className="text-sm text-destructive">Failed to generate recap. Please try again.</p>
          )}

          {/* Inline preview */}
          {recapStatus === "generating" && !recapData && (
            <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Generating your day recap...</span>
            </div>
          )}

          {recapData && (
            <div className="mt-2 max-h-[50vh] overflow-y-auto rounded-xl border border-border">
              <NewspaperContent recap={recapData} />
            </div>
          )}

          {/* Email section */}
          {recapData && (
            <div className="mt-4 border-t pt-4">
              <Label className="text-sm font-semibold">Email Report to Users</Label>
              {recipients.length > 0 ? (
                <>
                  <div className="mt-2 mb-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleAllRecipients}
                      className="text-xs text-primary hover:underline"
                    >
                      {selectedRecipients.size === recipients.length ? "Deselect All" : "Select All"}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {selectedRecipients.size} of {recipients.length} selected
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-md border border-border p-2 space-y-1">
                    {recipients.map((r) => (
                      <label
                        key={r.id}
                        className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedRecipients.has(r.id)}
                          onChange={() => toggleRecipient(r.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span>{r.name}</span>
                        <span className="text-xs text-muted-foreground">{r.userEmail}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Button
                      onClick={handleSendEmail}
                      disabled={selectedRecipients.size === 0 || emailStatus === "sending"}
                      size="sm"
                    >
                      {emailStatus === "sending" ? (
                        <>
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="mr-1 h-4 w-4" />
                          Send Email
                        </>
                      )}
                    </Button>
                    {emailStatus === "sent" && (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <CheckCheck className="h-4 w-4" />
                        Sent to {emailSentCount} {emailSentCount === 1 ? "user" : "users"}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Loading recipients...</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Print-friendly HTML builder ──────────────────────────────

function buildPrintHtml(recap: DayRecapData): string {
  const statsRow = [
    { label: "Attendees", value: recap.stats.attendees },
    { label: "Messages", value: recap.stats.messages },
    { label: "Connections", value: recap.stats.connections },
    { label: "Sessions", value: recap.stats.sessions },
    { label: "Rooms", value: recap.stats.breakoutRooms },
    { label: "@sia", value: recap.stats.siaCommands },
  ]
    .map(
      (s) =>
        `<td style="text-align:center;padding:12px 8px;background:#faf8f4;">
          <div style="font-size:18px;font-weight:700;">${s.value}</div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;">${s.label}</div>
        </td>`
    )
    .join("");

  const headlines = recap.headlines
    .map(
      (h) => `
        <div style="margin:10px 0;padding:12px;border:1px solid #e5e5e5;border-radius:8px;break-inside:avoid;">
          <strong>${h.headline}</strong>${h.hot ? " &#128293;" : ""}
          <p style="margin:6px 0 0;font-size:13px;color:#555;">${h.summary}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#999;">${h.room}${h.messages > 0 ? ` &middot; ${h.messages} msgs` : ""}</p>
        </div>`
    )
    .join("");

  const quotes = recap.topQuotes
    .map(
      (q) => `
        <blockquote style="margin:10px 0;padding:10px 14px;border-left:3px solid #6366f1;background:#f9fafb;border-radius:4px;break-inside:avoid;">
          <p style="margin:0;font-style:italic;font-size:13px;">&ldquo;${q.text}&rdquo;</p>
          <p style="margin:4px 0 0;font-size:11px;color:#888;">&mdash; ${q.author}</p>
        </blockquote>`
    )
    .join("");

  const awards = recap.awards
    .map(
      (a) => `
        <div style="margin:8px 0;padding:10px;border:1px solid #e5e5e5;border-radius:8px;display:flex;gap:10px;align-items:flex-start;break-inside:avoid;">
          <span style="font-size:20px;">${a.emoji}</span>
          <div>
            <strong style="font-size:13px;">${a.title}</strong>
            <p style="margin:2px 0 0;font-size:12px;color:#666;">${a.detail}</p>
          </div>
        </div>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>The ${recap.conference} Times — Day ${recap.day}</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { margin: 0; padding: 24px; background: #faf8f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111; }
    .container { max-width: 700px; margin: 0 auto; }
    h2.section { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #666; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 28px; }
  </style>
</head>
<body onload="setTimeout(()=>window.print(),500)">
  <div class="container">
    <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:16px;">
      <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#888;">${recap.date}</p>
      <h1 style="margin:4px 0;font-size:28px;font-weight:900;text-transform:uppercase;">The ${recap.conference} Times</h1>
      <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;">Day ${recap.day} Edition</p>
      <p style="margin:10px 0 0;font-style:italic;font-size:15px;color:#444;">&ldquo;${recap.tagline}&rdquo;</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <tr>${statsRow}</tr>
    </table>

    ${recap.headlines.length > 0 ? `<h2 class="section">Headlines</h2>${headlines}` : ""}
    ${recap.topQuotes.length > 0 ? `<h2 class="section">Quoteboard</h2>${quotes}` : ""}
    ${recap.awards.length > 0 ? `<h2 class="section">Day ${recap.day} Awards</h2>${awards}` : ""}

    <div style="text-align:center;margin-top:32px;padding-top:12px;border-top:1px solid #ddd;">
      <p style="font-size:9px;color:#999;letter-spacing:1px;">AI-GENERATED RECAP &bull; ${recap.generatedAt ? new Date(recap.generatedAt).toLocaleString() : ""}</p>
    </div>
  </div>
</body>
</html>`;
}
