"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { authClient } from "@/lib/auth-client";
import { Check, Loader2 } from "lucide-react";

export default function AccountPage() {
  const { data: session } = authClient.useSession();

  // Profile fields
  const [title, setTitle] = useState("");
  const [interests, setInterests] = useState("");
  const [company, setCompany] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setTitle(data.title ?? "");
          setInterests(data.interests ?? "");
          setCompany(data.company ?? "");
        }
      })
      .finally(() => setProfileLoading(false));
  }, []);

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileSaved(false);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, interests, company }),
    });
    if (res.ok) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }
    setProfileSaving(false);
  };

  const handlePasswordChange = async () => {
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        const data = await res.json().catch(() => null);
        setPasswordError(data?.message ?? "Failed to change password");
      }
    } catch {
      setPasswordError("Something went wrong");
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Account Settings"
        subtitle={session?.user?.email ?? ""}
      />

      <div className="mx-auto max-w-xl space-y-8">
        {/* Profile Section */}
        <section className="rounded-xl border border-border p-6">
          <h2 className="mb-4 text-base font-semibold">Profile</h2>
          {profileLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="acc-title">Title</Label>
                <Input
                  id="acc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. VP, Engineering"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="acc-company">Company</Label>
                <Input
                  id="acc-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Scotiabank"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="acc-interests">Interests</Label>
                <textarea
                  id="acc-interests"
                  className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                  placeholder="Topics you're interested in discussing..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleProfileSave} disabled={profileSaving} size="sm">
                  {profileSaving ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : profileSaved ? (
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                  ) : null}
                  {profileSaved ? "Saved" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Password Section */}
        <section className="rounded-xl border border-border p-6">
          <h2 className="mb-4 text-base font-semibold">Change Password</h2>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="acc-current-pw">Current Password</Label>
              <Input
                id="acc-current-pw"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-new-pw">New Password</Label>
              <Input
                id="acc-new-pw"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="acc-confirm-pw">Confirm New Password</Label>
              <Input
                id="acc-confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-600">Password changed successfully</p>
            )}
            <div>
              <Button
                onClick={handlePasswordChange}
                disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                size="sm"
              >
                {passwordSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Change Password
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
