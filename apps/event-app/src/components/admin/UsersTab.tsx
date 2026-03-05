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
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Mic2,
  MicOff,
  Shield,
  ShieldOff,
  Ban,
  Check,
  KeyRound,
  Mail,
} from "lucide-react";

interface Person {
  id: string;
  name: string;
  title: string | null;
  imageUrl: string | null;
  initials: string | null;
  isSpeaker: boolean;
  company: string | null;
  bio: string | null;
  createdAt: string;
  userEmail: string | null;
  userRole: string | null;
  userBlocked: boolean | null;
  userTwoFactorEnabled: boolean | null;
}

const emptyForm = {
  name: "",
  title: "",
  imageUrl: "",
  initials: "",
  isSpeaker: false,
  company: "",
  bio: "",
  email: "",
  password: "",
};

export function UsersTab() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Person | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [setPasswordChecked, setSetPasswordChecked] = useState(false);

  const fetchPeople = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/attendees");
    if (res.ok) setPeople(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchPeople(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setSetPasswordChecked(false);
    setDialogOpen(true);
  };

  const openEdit = (p: Person) => {
    setEditing(p);
    setForm({
      name: p.name,
      title: p.title ?? "",
      imageUrl: p.imageUrl ?? "",
      initials: p.initials ?? "",
      isSpeaker: p.isSpeaker,
      company: p.company ?? "",
      bio: p.bio ?? "",
      email: p.userEmail ?? "",
      password: "",
    });
    setSetPasswordChecked(false);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const url = editing ? `/api/admin/attendees/${editing.id}` : "/api/admin/attendees";
    const method = editing ? "PUT" : "POST";
    const { email, password, ...rest } = form;
    let payload: Record<string, unknown> = rest;
    if (!editing && email) {
      payload = password ? { ...rest, email, password } : { ...rest, email };
    }
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setDialogOpen(false);
      fetchPeople();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this attendee?")) return;
    const res = await fetch(`/api/admin/attendees/${id}`, { method: "DELETE" });
    if (res.ok) fetchPeople();
  };

  const toggleSpeaker = async (p: Person) => {
    const res = await fetch(`/api/admin/attendees/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSpeaker: !p.isSpeaker }),
    });
    if (res.ok) fetchPeople();
  };

  const toggleRole = async (p: Person) => {
    const newRole = p.userRole === "admin" ? "user" : "admin";
    const res = await fetch(`/api/admin/users/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) fetchPeople();
  };

  const toggleBlocked = async (p: Person) => {
    const res = await fetch(`/api/admin/users/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocked: !p.userBlocked }),
    });
    if (res.ok) fetchPeople();
  };

  const openPasswordDialog = (p: Person) => {
    setSelectedPerson(p);
    setNewPassword("");
    setResetEmailSent(false);
    setPasswordDialogOpen(true);
  };

  const handleSetPassword = async () => {
    if (!selectedPerson || !newPassword) return;
    await fetch(`/api/admin/users/${selectedPerson.id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });
    setPasswordDialogOpen(false);
  };

  const handleSendResetEmail = async () => {
    if (!selectedPerson) return;
    setSendingResetEmail(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedPerson.id}/send-reset-email`, {
        method: "POST",
      });
      if (res.ok) setResetEmailSent(true);
    } finally {
      setSendingResetEmail(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-1 h-4 w-4" /> Add Attendee
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : people.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attendees yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.name}</span>
                    {p.isSpeaker && (
                      <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0">
                        <Mic2 className="h-2.5 w-2.5" />
                        Speaker
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{p.title || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.userEmail || "—"}
                </TableCell>
                <TableCell>
                  {p.userRole ? (
                    <Badge variant={p.userRole === "admin" ? "default" : "outline"}>
                      {p.userRole}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {p.userEmail ? (
                    p.userBlocked ? (
                      <Badge variant="destructive">Blocked</Badge>
                    ) : (
                      <Badge variant="outline">Active</Badge>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">No account</span>
                  )}
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
                    className="w-48 rounded-lg border border-border bg-white p-1 shadow-lg"
                  >
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                      onMouseDown={() => openEdit(p)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                      onMouseDown={() => toggleSpeaker(p)}
                    >
                      {p.isSpeaker ? (
                        <>
                          <MicOff className="h-3.5 w-3.5" />
                          Remove Speaker
                        </>
                      ) : (
                        <>
                          <Mic2 className="h-3.5 w-3.5" />
                          Set as Speaker
                        </>
                      )}
                    </button>
                    {p.userEmail && (
                      <>
                        <div className="mx-2 my-1 border-t border-border" />
                        <button
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                          onMouseDown={() => toggleRole(p)}
                        >
                          {p.userRole === "admin" ? (
                            <>
                              <ShieldOff className="h-3.5 w-3.5" />
                              Remove Admin
                            </>
                          ) : (
                            <>
                              <Shield className="h-3.5 w-3.5" />
                              Make Admin
                            </>
                          )}
                        </button>
                        <button
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                          onMouseDown={() => toggleBlocked(p)}
                        >
                          {p.userBlocked ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-green-600" />
                              Unblock
                            </>
                          ) : (
                            <>
                              <Ban className="h-3.5 w-3.5 text-destructive" />
                              Block
                            </>
                          )}
                        </button>
                        <button
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted"
                          onMouseDown={() => openPasswordDialog(p)}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Reset Password
                        </button>
                      </>
                    )}
                    <div className="mx-2 my-1 border-t border-border" />
                    <button
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                      onMouseDown={() => handleDelete(p.id)}
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

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Attendee" : "Add Attendee"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update attendee details." : "Fill in the attendee details."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="u-name">Name</Label>
                <Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="u-initials">Initials</Label>
                <Input id="u-initials" value={form.initials} onChange={(e) => setForm({ ...form, initials: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="u-title">Title</Label>
                <Input id="u-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="u-company">Company</Label>
                <Input id="u-company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="u-image">Image URL</Label>
              <Input id="u-image" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="u-email">Email</Label>
              {editing?.userEmail ? (
                <Input id="u-email" value={form.email} disabled className="bg-muted" />
              ) : (
                <Input
                  id="u-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="user@example.com"
                />
              )}
            </div>
            {!editing && form.email && (
              <div className="grid gap-2">
                <Label htmlFor="u-password">Password</Label>
                <Input
                  id="u-password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min 8 characters"
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                id="u-speaker"
                type="checkbox"
                checked={form.isSpeaker}
                onChange={(e) => setForm({ ...form, isSpeaker: e.target.checked })}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              <Label htmlFor="u-speaker" className="cursor-pointer">Speaker</Label>
            </div>
            {form.isSpeaker && (
              <div className="grid gap-2">
                <Label htmlFor="u-bio">Bio</Label>
                <textarea
                  id="u-bio"
                  className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="Speaker biography..."
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {selectedPerson?.name} ({selectedPerson?.userEmail})
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Option 1: Send reset email */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Send Reset Email</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Send a secure link to the user&apos;s email. They&apos;ll verify and set their own password.
              </p>
              {resetEmailSent ? (
                <p className="text-xs font-medium text-green-600">Reset email sent to {selectedPerson?.userEmail}</p>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSendResetEmail}
                  disabled={sendingResetEmail}
                  className="w-full"
                >
                  {sendingResetEmail ? "Sending..." : "Send Reset Link"}
                </Button>
              )}
            </div>

            {/* Option 2: Set password directly */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Set Password Directly</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Set the password immediately without email verification.
              </p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleSetPassword}
                  disabled={newPassword.length < 8}
                >
                  Set
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
