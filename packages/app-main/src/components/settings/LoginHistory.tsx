"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  IconMapPin,
  IconShieldCheck,
  IconLogin,
  IconDeviceDesktop,
  IconDeviceMobile,
} from "@tabler/icons-react";

interface LoginEvent {
  id: string;
  ipAddress: string;
  userAgent: string | null;
  event: string;
  createdAt: string;
}

const EVENT_LABELS: Record<string, { label: string; icon: typeof IconLogin }> = {
  login: { label: "Sign in", icon: IconLogin },
  two_factor_verified: { label: "2FA verified", icon: IconShieldCheck },
  session_created: { label: "Session created", icon: IconLogin },
};

function isMobileUA(ua: string | null): boolean {
  if (!ua) return false;
  return /Mobile|Android|iPhone|iPad/i.test(ua);
}

export function LoginHistory() {
  const [history, setHistory] = useState<LoginEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user/login-history")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.history) {
          setHistory(data.history);
        }
      })
      .catch(() => {
        toast.error("Failed to load login history");
      })
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-muted-foreground">Loading login history...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Login History</CardTitle>
        <CardDescription>
          Recent sign-in activity on your account. Review for any unfamiliar
          locations or devices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No login history yet.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.map((entry) => {
              const eventInfo = EVENT_LABELS[entry.event] || EVENT_LABELS.login;
              const EventIcon = eventInfo.icon;
              const mobile = isMobileUA(entry.userAgent);

              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <EventIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {eventInfo.label}
                        </span>
                        {mobile ? (
                          <IconDeviceMobile className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <IconDeviceDesktop className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <IconMapPin className="h-3 w-3" />
                        <span>{entry.ipAddress}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
