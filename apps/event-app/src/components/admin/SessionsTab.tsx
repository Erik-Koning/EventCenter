"use client";

import { useEffect, useState } from "react";
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
import { Plus, MoreVertical, Pencil, Trash2 } from "lucide-react";

interface Speaker {
  id: string;
  name: string;
}

interface SessionSpeaker {
  speaker: Speaker;
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
      speakerIds: s.sessionSpeakers.map((ss) => ss.speaker.id),
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
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Session
        </Button>
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
                  {s.sessionSpeakers.map((ss) => ss.speaker.name).join(", ") || "—"}
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
    </div>
  );
}
