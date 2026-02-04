"use client";

import { useState, useEffect, useCallback } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { IconDeviceDesktop, IconDeviceMobile, IconTrash, IconClock } from "@tabler/icons-react";

interface SessionInfo {
  id: string;
  token: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}

const TIMEOUT_OPTIONS = [
  { value: "null", label: "Server default (7 days)" },
  { value: "1", label: "1 hour" },
  { value: "4", label: "4 hours" },
  { value: "8", label: "8 hours" },
  { value: "12", label: "12 hours" },
  { value: "24", label: "1 day" },
  { value: "48", label: "2 days" },
  { value: "72", label: "3 days" },
  { value: "168", label: "7 days" },
] as const;

function parseUserAgent(ua: string | null): { device: string; browser: string } {
  if (!ua) return { device: "Unknown", browser: "Unknown" };

  let browser = "Unknown";
  if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edg")) browser = "Edge";
  else if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";

  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const device = isMobile ? "Mobile" : "Desktop";

  return { device, browser };
}

export function SessionManagement() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [currentToken, setCurrentToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [timeoutValue, setTimeoutValue] = useState<string>("null");
  const [isSavingTimeout, setIsSavingTimeout] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setTimeoutValue(
          data.sessionTimeoutHours != null
            ? String(data.sessionTimeoutHours)
            : "null"
        );
      }
    } catch {
      // Profile fetch is best-effort
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const result = await authClient.listSessions();
        if (result.data) {
          setSessions(result.data as unknown as SessionInfo[]);
        }

        const session = await authClient.getSession();
        if (session.data?.session) {
          setCurrentToken(session.data.session.token);
        }
      } catch {
        toast.error("Failed to load sessions");
      } finally {
        setIsLoading(false);
      }
    };

    init();
    loadProfile();
  }, [loadProfile]);

  const handleRevoke = async (token: string) => {
    setRevokingId(token);
    try {
      await authClient.revokeSession({ token });
      setSessions((prev) => prev.filter((s) => s.token !== token));
      toast.success("Session revoked");
    } catch {
      toast.error("Failed to revoke session");
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    try {
      await authClient.revokeOtherSessions();
      setSessions((prev) => prev.filter((s) => s.token === currentToken));
      toast.success("All other sessions revoked");
    } catch {
      toast.error("Failed to revoke sessions");
    }
  };

  const handleTimeoutChange = async (value: string) => {
    setTimeoutValue(value);
    setIsSavingTimeout(true);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionTimeoutHours: value === "null" ? null : Number(value),
        }),
      });

      if (!res.ok) throw new Error("Failed to save");
      toast.success("Session timeout updated");
    } catch {
      toast.error("Failed to update session timeout");
    } finally {
      setIsSavingTimeout(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-muted-foreground">Loading sessions...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Sessions</CardTitle>
        <CardDescription>
          Manage your active sessions across devices. You can revoke any session
          to sign out of that device.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session timeout setting */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-3">
            <IconClock className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Auto-logout timer</div>
              <div className="text-xs text-muted-foreground">
                Automatically sign out after this period of time
              </div>
            </div>
          </div>
          <Select
            value={timeoutValue}
            onValueChange={handleTimeoutChange}
            disabled={isSavingTimeout}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEOUT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Active sessions list */}
        {sessions.map((session) => {
          const { device, browser } = parseUserAgent(session.userAgent);
          const isCurrent = session.token === currentToken;

          return (
            <div
              key={session.id}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                {device === "Mobile" ? (
                  <IconDeviceMobile className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <IconDeviceDesktop className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {browser} on {device}
                    </span>
                    {isCurrent && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {session.ipAddress || "Unknown IP"}
                    {" · "}
                    {new Date(session.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              {!isCurrent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRevoke(session.token)}
                  disabled={revokingId === session.token}
                >
                  <IconTrash className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })}

        {sessions.length > 1 && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleRevokeOthers}
          >
            Revoke All Other Sessions
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
