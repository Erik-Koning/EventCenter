"use client";

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IconClock } from "@tabler/icons-react";
import { toast } from "sonner";

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Halifax",
  "America/St_Johns",
  "America/Winnipeg",
  "America/Edmonton",
  "America/Regina",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Zurich",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];

export function TimezoneSettings() {
  const [timezone, setTimezone] = useState("UTC");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/users/getUserSafeColumns")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.timezone) {
          setTimezone(data.timezone);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleChange = async (newTimezone: string) => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: newTimezone }),
      });

      if (res.ok) {
        setTimezone(newTimezone);
        toast.success("Timezone updated");
      } else {
        toast.error("Failed to update timezone");
      }
    } catch {
      toast.error("Failed to update timezone");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <IconClock className="h-5 w-5" />
        <h2 className="text-lg font-medium">Timezone</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Set your timezone for accurate time-based features like daily reminders
        and activity tracking.
      </p>
      <div className="space-y-2 max-w-md">
        <Label htmlFor="timezone">Your timezone</Label>
        <Select value={timezone} onValueChange={handleChange} disabled={isSaving}>
          <SelectTrigger id="timezone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMMON_TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
