"use client";

import { useEffect, useState } from "react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { IconLoader, IconLock } from "@tabler/icons-react";
import { Separator } from "@/src/components/ui/separator";
import { Skeleton } from "@/src/components/ui/skeleton";
import { toast } from "@common/components/ui/sonner";

import { authClient } from "@/src/lib/auth-client";
import { TwoFactorSettings } from "@/components/settings/TwoFactorSettings";
import { SessionManagement } from "@/components/settings/SessionManagement";
import { LoginHistory } from "@/components/settings/LoginHistory";

import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();

  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  async function getUser() {
    const { data: session } = await authClient.getSession();
    // // if (!session?.user) {
    // //   return router.push("/login");
    // // }
    // console.log(session);
    return session;
  }

  useEffect(() => {
    getUser().then((data) => {
      setFullname(data?.user?.name ?? ""); // Use empty string as fallback
      setEmail(data?.user?.email ?? "");
    });
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    // Validation
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (result.error) {
        setPasswordError(result.error.message || "Failed to change password");
        return;
      }

      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to change password"
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return !email ? (
    <div className="px-4 lg:px-6 lg:w-1/2 grid gap-4">
      <Skeleton className="w-1/2 h-[20px] rounded-full" />
      <Skeleton className="w-2/3 h-[20px] rounded-full" />
      <Separator className="mb-4" />
      <Skeleton className="w-full h-[20px] rounded-full" />
      <Skeleton className="w-full h-[30px] rounded-full" />
      <Skeleton className="w-full h-[20px] rounded-full" />
      <Skeleton className="w-full h-[30px] rounded-full" />
      <Skeleton className="w-full h-[30px] rounded-full" />
    </div>
  ) : (
    <>
      <div className="px-4 lg:px-6">
        <h1 className="text-lg font-medium">Account Setting</h1>
        <p className="text-sm text-muted-foreground mb-2">
          Edit your account information
        </p>
        <Separator className="mb-4" />
        <form className="lg:w-1/2">
          <div className="flex flex-col gap-6">
            <div className="grid gap-3">
              <Label htmlFor="email">Full Name</Label>
              <Input
                onChange={(e) => setFullname(e.target.value)}
                value={fullname}
                id="name"
                type="text"
                placeholder="John Doe"
                required
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="email">Email</Label>
              <Input
                onChange={(e) => setEmail(e.target.value)}
                value={email}
                id="email"
                type="email"
                placeholder="me@example.com"
                required
              />
            </div>

            <div className="flex flex-col gap-3">
              <Button disabled={loading} type="submit" className="w-full">
                {loading ? (
                  <IconLoader className="animate-spin" stroke={2} />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </form>

        {/* Password Change Section */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <IconLock className="h-5 w-5" />
            <h2 className="text-lg font-medium">Change Password</h2>
          </div>
          <Separator className="mb-4" />

          <form onSubmit={handlePasswordChange} className="lg:w-1/2">
            <div className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-500">{passwordError}</p>
              )}

              <Button
                type="submit"
                disabled={isChangingPassword}
                className="w-full"
              >
                {isChangingPassword ? (
                  <IconLoader className="animate-spin" stroke={2} />
                ) : (
                  "Change Password"
                )}
              </Button>
            </div>
          </form>
        </div>

        <Separator className="my-8" />
        <TwoFactorSettings />

        <Separator className="my-8" />
        <SessionManagement />

        <Separator className="my-8" />
        <LoginHistory />
      </div>
    </>
  );
}
