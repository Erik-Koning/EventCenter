"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@common/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

type TwoFactorMode = "each_time" | "remember_30_days" | "new_ip_only";

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [mode, setMode] = useState<TwoFactorMode>("each_time");
  const [isLocked, setIsLocked] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);

  const checkLockout = useCallback(async () => {
    try {
      const res = await fetch("/api/user/two-factor/attempt");
      if (res.ok) {
        const data = await res.json();
        setIsLocked(data.locked);
        setLockedUntil(data.lockedUntilISO || null);
        setAttemptsRemaining(data.attemptsRemaining);
      }
    } catch {
      // Best-effort
    }
  }, []);

  useEffect(() => {
    // Fetch 2FA mode to control trust checkbox visibility
    fetch("/api/user/two-factor/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings?.mode) {
          setMode(data.settings.mode);
        }
      })
      .catch(() => {});

    checkLockout();
  }, [checkLockout]);

  // Auto-unlock when lockout expires
  useEffect(() => {
    if (!isLocked || !lockedUntil) return;

    const remaining = new Date(lockedUntil).getTime() - Date.now();
    if (remaining <= 0) {
      setIsLocked(false);
      setLockedUntil(null);
      checkLockout();
      return;
    }

    const timer = setTimeout(() => {
      setIsLocked(false);
      setLockedUntil(null);
      checkLockout();
    }, remaining);

    return () => clearTimeout(timer);
  }, [isLocked, lockedUntil, checkLockout]);

  const reportFailedAttempt = async () => {
    try {
      const res = await fetch("/api/user/two-factor/attempt", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setIsLocked(data.locked);
        setLockedUntil(data.lockedUntilISO || null);
        setAttemptsRemaining(data.attemptsRemaining ?? null);
      }
    } catch {
      // Best-effort
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isLocked) {
      toast.error("Account is temporarily locked. Please try again later.");
      return;
    }

    setIsLoading(true);

    try {
      if (useBackupCode) {
        const result = await authClient.twoFactor.verifyBackupCode({
          code,
        });

        if (result.error) {
          toast.error(result.error.message || "Invalid backup code");
          await reportFailedAttempt();
          setIsLoading(false);
          return;
        }
      } else {
        const result = await authClient.twoFactor.verifyTotp({
          code,
          trustDevice: mode === "remember_30_days" ? trustDevice : false,
        });

        if (result.error) {
          toast.error(result.error.message || "Invalid verification code");
          await reportFailedAttempt();
          setIsLoading(false);
          return;
        }
      }

      // Record the verification time server-side
      await fetch("/api/user/two-factor/verified", { method: "POST" });

      toast.success("Verification successful!");
      router.push("/dashboard");
    } catch {
      toast.error("Verification failed. Please try again.");
      await reportFailedAttempt();
      setIsLoading(false);
    }
  };

  const showTrustCheckbox = !useBackupCode && mode === "remember_30_days";

  const lockoutMessage =
    isLocked && lockedUntil
      ? `Account locked until ${new Date(lockedUntil).toLocaleTimeString()}`
      : null;

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Two-Factor Authentication</CardTitle>
          <CardDescription>
            {useBackupCode
              ? "Enter one of your backup codes to verify your identity"
              : "Enter the 6-digit code from your authenticator app"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lockoutMessage && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
              {lockoutMessage}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">
                {useBackupCode ? "Backup Code" : "Verification Code"}
              </Label>
              <Input
                id="code"
                type="text"
                placeholder={useBackupCode ? "Enter backup code" : "000000"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                maxLength={useBackupCode ? 20 : 6}
                className="text-center text-2xl tracking-widest"
                autoComplete="one-time-code"
                autoFocus
                disabled={isLocked}
              />
            </div>

            {attemptsRemaining !== null && attemptsRemaining < 5 && !isLocked && (
              <p className="text-xs text-muted-foreground text-center">
                {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""} remaining
              </p>
            )}

            {showTrustCheckbox && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="trustDevice"
                  checked={trustDevice}
                  onChangeChecked={(checked) => setTrustDevice(checked)}
                />
                <Label htmlFor="trustDevice" className="text-sm font-normal">
                  Trust this device for 30 days
                </Label>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || isLocked}
            >
              {isLoading ? "Verifying..." : "Verify"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:underline"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setCode("");
                }}
              >
                {useBackupCode
                  ? "Use authenticator app instead"
                  : "Lost access to authenticator? Use backup code"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
