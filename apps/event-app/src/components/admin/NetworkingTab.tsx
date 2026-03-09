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
import { Plus, MoreVertical, Pencil, Trash2, Users } from "lucide-react";
import { useAdminStore } from "@/lib/stores/adminStore";

interface Group {
  id: string;
  name: string;
  description: string | null;
  creatorName: string | null;
  eventId: string | null;
  memberCount: number;
  topWords: string[] | null;
  insights: { title: string; description: string }[] | null;
  createdAt: string;
}

const emptyForm = {
  name: "",
  description: "",
};

export function NetworkingTab() {
  const managedEventId = useAdminStore((s) => s.managedEventId);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Group | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchGroups = async () => {
    if (!managedEventId) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/admin/networking?eventId=${managedEventId}`);
    if (res.ok) setGroups(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, [managedEventId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (g: Group) => {
    setEditing(g);
    setForm({
      name: g.name,
      description: g.description ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const url = editing
      ? `/api/admin/networking/${editing.id}`
      : "/api/admin/networking";
    const method = editing ? "PUT" : "POST";
    const payload = editing
      ? { name: form.name, description: form.description || undefined }
      : { name: form.name, description: form.description || undefined, eventId: managedEventId };
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setDialogOpen(false);
      fetchGroups();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this networking group? All messages and members will be removed.")) return;
    const res = await fetch(`/api/admin/networking/${id}`, { method: "DELETE" });
    if (res.ok) fetchGroups();
  };

  if (!managedEventId) {
    return <p className="text-sm text-muted-foreground">Please select an event to manage networking groups.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Group
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No networking groups found.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Topics</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.name}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">
                  {g.description || "—"}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    {g.memberCount}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(g.topWords ?? []).slice(0, 3).map((w) => (
                      <Badge key={w} variant="outline" className="text-[10px]">{w}</Badge>
                    ))}
                    {!g.topWords?.length && "—"}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {g.creatorName || "—"}
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
                      onMouseDown={() => openEdit(g)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                      onMouseDown={() => handleDelete(g.id)}
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
            <DialogTitle>{editing ? "Edit Networking Group" : "Create Networking Group"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update group details." : "Fill in the group details."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="g-name">Name</Label>
              <Input
                id="g-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. AI & Innovation"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="g-desc">Description</Label>
              <Input
                id="g-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this group about?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim()}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
