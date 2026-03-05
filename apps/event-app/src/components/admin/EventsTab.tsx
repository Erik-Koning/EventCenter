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
import { Plus, MoreVertical, Pencil, Trash2, Sparkles } from "lucide-react";

interface Event {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  venue: string | null;
  location: string | null;
  createdAt: string;
}

const emptyForm = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  venue: "",
  location: "",
};

export function EventsTab() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchEvents = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/events");
    if (res.ok) setEvents(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (ev: Event) => {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description ?? "",
      startDate: ev.startDate,
      endDate: ev.endDate,
      venue: ev.venue ?? "",
      location: ev.location ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const url = editing ? `/api/admin/events/${editing.id}` : "/api/admin/events";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setDialogOpen(false);
      fetchEvents();
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/admin/seed", { method: "POST" });
      if (res.ok) fetchEvents();
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    if (res.ok) fetchEvents();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <Button onClick={handleSeed} size="sm" variant="outline" disabled={seeding}>
          <Sparkles className="mr-1 h-4 w-4" />
          {seeding ? "Seeding..." : "Seed Example Event"}
        </Button>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Event
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Venue</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((ev) => (
              <TableRow key={ev.id}>
                <TableCell className="font-medium">{ev.title}</TableCell>
                <TableCell>{ev.startDate}</TableCell>
                <TableCell>{ev.endDate}</TableCell>
                <TableCell>{ev.venue || "—"}</TableCell>
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
                      onMouseDown={() => openEdit(ev)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                      onMouseDown={() => handleDelete(ev.id)}
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
        <DialogContent className="sm:max-w-lg rounded-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Event" : "Create Event"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update event details." : "Fill in the event details."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="venue">Venue</Label>
                <Input id="venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
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
