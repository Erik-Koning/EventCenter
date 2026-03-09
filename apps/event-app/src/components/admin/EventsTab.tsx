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
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@common/components/ui/DropdownMenu";
import { Plus, MoreVertical, Pencil, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useAdminStore } from "@/lib/stores/adminStore";

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

interface DeleteTarget {
  event: Event;
  sessionCount: number;
  attendeeCount: number;
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
  const managedEventId = useAdminStore((s) => s.managedEventId);
  const setManagedEventId = useAdminStore((s) => s.setManagedEventId);
  const setActiveTab = useAdminStore((s) => s.setActiveTab);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteFetching, setDeleteFetching] = useState(false);

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
    const isCreating = !editing;
    const url = editing ? `/api/admin/events/${editing.id}` : "/api/admin/events";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const data = await res.json();
      setDialogOpen(false);
      fetchEvents();
      if (isCreating && data.id) {
        setManagedEventId(data.id);
        setActiveTab(1); // Switch to Attendees tab
      }
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

  const openDeleteConfirm = async (ev: Event) => {
    setDeleteFetching(true);
    setDeleteTarget({ event: ev, sessionCount: 0, attendeeCount: 0 });
    setDeleteConfirmInput("");
    try {
      const res = await fetch(`/api/admin/events/${ev.id}`);
      if (res.ok) {
        const data = await res.json();
        setDeleteTarget({
          event: ev,
          sessionCount: data.sessions?.length ?? 0,
          attendeeCount: data.eventAttendees?.length ?? 0,
        });
      }
    } finally {
      setDeleteFetching(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirmInput !== "DELETE") return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/events/${deleteTarget.event.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteTarget(null);
        fetchEvents();
      }
    } finally {
      setDeleteLoading(false);
    }
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
              <TableRow
                key={ev.id}
                className={`cursor-pointer ${managedEventId === ev.id ? "bg-primary/[0.04]" : ""}`}
                onClick={() => { setManagedEventId(ev.id); setActiveTab(1); }}
              >
                <TableCell className="font-medium">{ev.title}</TableCell>
                <TableCell>{ev.startDate}</TableCell>
                <TableCell>{ev.endDate}</TableCell>
                <TableCell>{ev.venue || "—"}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="bottom" align="end" className="w-40">
                      <DropdownMenuItem onSelect={() => openEdit(ev)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        onSelect={() => openDeleteConfirm(ev)}
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Are you sure you want to delete this event?</DialogTitle>
            <DialogDescription>
              {deleteFetching ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading event details...
                </span>
              ) : (
                <>
                  This event has{" "}
                  <span className="font-semibold text-foreground">
                    {deleteTarget?.sessionCount ?? 0} session{deleteTarget?.sessionCount === 1 ? "" : "s"}
                  </span>{" "}
                  and{" "}
                  <span className="font-semibold text-foreground">
                    {deleteTarget?.attendeeCount ?? 0} attendee{deleteTarget?.attendeeCount === 1 ? "" : "s"}
                  </span>
                  .
                </>
              )}
            </DialogDescription>
            <DialogDescription>
              Deleting this event will remove these sessions, attendees and all associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="delete-confirm">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteConfirmInput !== "DELETE" || deleteLoading || deleteFetching}
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Event"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
