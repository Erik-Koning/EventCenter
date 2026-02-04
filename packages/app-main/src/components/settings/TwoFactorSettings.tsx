"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@common/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@common/components/ui/dialog";
import { toast } from "sonner";

interface TwoFactorStatus {
  enabled: boolean;
  hasBackupCodes: boolean;
  settings: {
    mode: "each_time" | "remember_30_days" | "new_ip_only";
    trustedIps: string[];
  };
}

type SetupStep = "initial" | "qr" | "verify" | "backup";

export function TwoFactorSettings() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupStep, setSetupStep] = useState<SetupStep>("initial");
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [secret, setSecret] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [mode, setMode] = useState<TwoFactorStatus["settings"]["mode"]>("each_time");
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/user/two-factor/settings");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setMode(data.settings.mode);
      }
    } catch {
      toast.error("Failed to load 2FA status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnable = async () => {
    const password = prompt("Enter your password to enable 2FA:");
    if (!password) return;

    try {
      // Generate TOTP secret
      const result = await authClient.twoFactor.enable({
        password,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to enable 2FA");
        return;
      }

      if (result.data) {
        // Extract secret from TOTP URI (otpauth://totp/...?secret=XXX&...)
        const secretMatch = result.data.totpURI.match(/secret=([^&]+)/);
        setSecret(secretMatch?.[1] || "");
        setBackupCodes(result.data.backupCodes);

        // Generate QR code locally — TOTP secret never leaves the browser
        const dataUrl = await QRCode.toDataURL(result.data.totpURI, {
          width: 200,
          margin: 2,
        });
        setQrDataUrl(dataUrl);

        setSetupStep("qr");
        setShowSetupDialog(true);
      }
    } catch {
      toast.error("Failed to start 2FA setup");
    }
  };

  const handleVerifySetup = async () => {
    try {
      const result = await authClient.twoFactor.verifyTotp({
        code: verificationCode,
      });

      if (result.error) {
        toast.error(result.error.message || "Invalid verification code");
        return;
      }

      // Backup codes were already returned by enable() and stored in state
      setSetupStep("backup");
    } catch {
      toast.error("Verification failed");
    }
  };

  const handleCompleteSetup = () => {
    setShowSetupDialog(false);
    setSetupStep("initial");
    setVerificationCode("");
    setBackupCodes([]);
    fetchStatus();
    toast.success("Two-factor authentication enabled!");
  };

  const handleDisable = async () => {
    if (
      !confirm(
        "Are you sure you want to disable two-factor authentication? This will reduce your account security."
      )
    ) {
      return;
    }

    const password = prompt("Enter your password to disable 2FA:");
    if (!password) return;

    try {
      const result = await authClient.twoFactor.disable({ password });

      if (result.error) {
        toast.error(result.error.message || "Failed to disable 2FA");
        return;
      }

      fetchStatus();
      toast.success("Two-factor authentication disabled");
    } catch {
      toast.error("Failed to disable 2FA");
    }
  };

  const handleModeChange = async (newMode: typeof mode) => {
    try {
      const res = await fetch("/api/user/two-factor/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode }),
      });

      if (res.ok) {
        setMode(newMode);
        toast.success("2FA settings updated");
      } else {
        toast.error("Failed to update settings");
      }
    } catch {
      toast.error("Failed to update settings");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-muted-foreground">Loading 2FA settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Two-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra layer of security to your account by requiring a code
            from your authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status?.enabled ? (
            <>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500" />
                <span className="font-medium">2FA is enabled</span>
              </div>

              <div className="space-y-2">
                <Label>When to require verification</Label>
                <Select value={mode} onValueChange={handleModeChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="each_time">
                      Every time I sign in
                    </SelectItem>
                    <SelectItem value="remember_30_days">
                      Remember trusted devices for 30 days
                    </SelectItem>
                    <SelectItem value="new_ip_only">
                      Only when signing in from a new location
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  {mode === "each_time" &&
                    "You will need to enter a code every time you sign in."}
                  {mode === "remember_30_days" &&
                    "You can choose to trust a device when signing in. Trusted devices won't require 2FA for 30 days."}
                  {mode === "new_ip_only" &&
                    "You'll only need to verify when signing in from a new IP address."}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleDisable}>
                  Disable 2FA
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    const password = prompt("Enter your password to generate new backup codes:");
                    if (!password) return;
                    try {
                      const result =
                        await authClient.twoFactor.generateBackupCodes({
                          password,
                        });
                      if (result.data?.backupCodes) {
                        setBackupCodes(result.data.backupCodes);
                        setSetupStep("backup");
                        setShowSetupDialog(true);
                      }
                    } catch {
                      toast.error("Failed to generate backup codes");
                    }
                  }}
                >
                  Generate New Backup Codes
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-muted" />
                <span className="font-medium">2FA is not enabled</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Protect your account by requiring a verification code from an
                authenticator app like Google Authenticator, 1Password, or
                Authy.
              </p>
              <Button onClick={handleEnable}>Enable 2FA</Button>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {setupStep === "qr" && "Scan QR Code"}
              {setupStep === "verify" && "Verify Code"}
              {setupStep === "backup" && "Save Backup Codes"}
            </DialogTitle>
            <DialogDescription>
              {setupStep === "qr" &&
                "Scan this QR code with your authenticator app"}
              {setupStep === "verify" &&
                "Enter the 6-digit code from your authenticator app"}
              {setupStep === "backup" &&
                "Save these backup codes in a secure location. Each code can only be used once."}
            </DialogDescription>
          </DialogHeader>

          {setupStep === "qr" && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded">
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="2FA QR Code"
                      className="w-48 h-48"
                    />
                  )}
                </div>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                Or enter this code manually:
                <div className="mt-1 font-mono text-xs break-all bg-muted p-2 rounded">
                  {secret}
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => setSetupStep("verify")}
              >
                Continue
              </Button>
            </div>
          )}

          {setupStep === "verify" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verify-code">Verification Code</Label>
                <Input
                  id="verify-code"
                  type="text"
                  placeholder="000000"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
              <Button className="w-full" onClick={handleVerifySetup}>
                Verify and Enable
              </Button>
            </div>
          )}

          {setupStep === "backup" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded font-mono text-sm">
                {backupCodes.map((code, i) => (
                  <div key={i} className="p-1">
                    {code}
                  </div>
                ))}
              </div>
              <p className="text-sm text-destructive">
                Store these codes securely. If you lose access to your
                authenticator app, you can use these codes to sign in. Each code
                can only be used once.
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  // Copy to clipboard
                  navigator.clipboard.writeText(backupCodes.join("\n"));
                  toast.success("Backup codes copied to clipboard");
                }}
                variant="outline"
              >
                Copy to Clipboard
              </Button>
              <Button className="w-full" onClick={handleCompleteSetup}>
                I've Saved My Codes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
