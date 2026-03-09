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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@common/components/ui/DropdownMenu";
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
  Upload,
} from "lucide-react";
import { useAdminStore } from "@/lib/stores/adminStore";
import { ImportDialog } from "./ImportDialog";

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
};

export function UsersTab() {
  const managedEventId = useAdminStore((s) => s.managedEventId);
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
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);

  const fetchPeople = async () => {
    if (!managedEventId) {
      setPeople([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Fetch all users with full detail and event attendee list (which includes isSpeaker/bio)
    const [allRes, enrolledRes] = await Promise.all([
      fetch("/api/admin/attendees"),
      fetch(`/api/admin/events/${managedEventId}/attendees`),
    ]);
    if (allRes.ok && enrolledRes.ok) {
      const allUsers: Omit<Person, "isSpeaker" | "bio">[] = await allRes.json();
      const enrolled: { userId: string; isSpeaker: boolean; bio: string | null }[] = await enrolledRes.json();
      const enrollmentMap = new Map(enrolled.map((e) => [e.userId, e]));
      setPeople(
        allUsers
          .filter((p) => enrollmentMap.has(p.id))
          .map((p) => {
            const enrollment = enrollmentMap.get(p.id)!;
            return { ...p, isSpeaker: enrollment.isSpeaker, bio: enrollment.bio };
          })
      );
    }
    setLoading(false);
  };

  useEffect(() => { fetchPeople(); }, [managedEventId]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
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
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const url = editing ? `/api/admin/attendees/${editing.id}` : "/api/admin/attendees";
    const method = editing ? "PUT" : "POST";
    const { email, ...rest } = form;
    let payload: Record<string, unknown> = { ...rest, eventId: managedEventId };
    if (!editing && email) {
      payload = { ...rest, email, eventId: managedEventId };
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/admin/attendees/${deleteTarget.id}?eventId=${managedEventId}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteTarget(null);
      fetchPeople();
    }
  };

  const toggleSpeaker = async (p: Person) => {
    const res = await fetch(`/api/admin/attendees/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSpeaker: !p.isSpeaker, eventId: managedEventId }),
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

  if (!managedEventId) {
    return <p className="text-sm text-muted-foreground">Please select an event to manage attendees.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <Button onClick={() => setImportOpen(true)} size="sm" variant="outline">
          <Upload className="mr-1 h-4 w-4" /> Import
        </Button>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-muted">
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="bottom" align="end" className="w-48">
                      <DropdownMenuItem onSelect={() => openEdit(p)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => toggleSpeaker(p)}>
                        {p.isSpeaker ? (
                          <>
                            <MicOff className="mr-2 h-3.5 w-3.5" />
                            Remove Speaker
                          </>
                        ) : (
                          <>
                            <Mic2 className="mr-2 h-3.5 w-3.5" />
                            Set as Speaker
                          </>
                        )}
                      </DropdownMenuItem>
                      {p.userEmail && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => toggleRole(p)}>
                            {p.userRole === "admin" ? (
                              <>
                                <ShieldOff className="mr-2 h-3.5 w-3.5" />
                                Remove Admin
                              </>
                            ) : (
                              <>
                                <Shield className="mr-2 h-3.5 w-3.5" />
                                Make Admin
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => toggleBlocked(p)}>
                            {p.userBlocked ? (
                              <>
                                <Check className="mr-2 h-3.5 w-3.5 text-green-600" />
                                Unblock
                              </>
                            ) : (
                              <>
                                <Ban className="mr-2 h-3.5 w-3.5 text-destructive" />
                                Block
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => openPasswordDialog(p)}>
                            <KeyRound className="mr-2 h-3.5 w-3.5" />
                            Reset Password
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        onClick={() => setDeleteTarget(p)}
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

      {/* Import dialog */}
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        type="attendees"
        eventId={managedEventId}
        onSuccess={fetchPeople}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm rounded-lg space-y-4">
          <DialogHeader>
            <DialogTitle>Remove Attendee</DialogTitle>
            <DialogDescription>
              Remove <span className="font-medium text-foreground">{deleteTarget?.name}</span> from this event? 
              <br />
              This only removes them from the current event, their account will not be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Remove</Button>
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
