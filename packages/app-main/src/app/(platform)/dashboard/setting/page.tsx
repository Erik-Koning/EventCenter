"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ModeToggle } from "@/src/components/mode-toggle";
import { Separator } from "@/src/components/ui/separator";
import { Label } from "@/src/components/ui/label";
import { Button } from "@common/components/ui/Button";
import { Badge } from "@/src/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Skeleton } from "@/src/components/ui/skeleton";
import { IconUsers, IconSettings, IconCrown, IconUserShield, IconUser } from "@tabler/icons-react";
import { toast } from "@common/components/ui/sonner";
import { TimezoneSettings } from "@/components/settings/TimezoneSettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";

interface Team {
  id: string;
  name: string;
  description: string | null;
  role: string;
}

const roleLabelMap: Record<string, string> = {
  owner: "Owner",
  admin: "Manager",
  member: "Member",
};

export default function SettingsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [isLoadingTeams, setIsLoadingTeams] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingTeams(true);
      try {
        // Load user's teams and active team in parallel
        const [teamsRes, activeTeamRes] = await Promise.all([
          fetch("/api/user/teams"),
          fetch("/api/user/active-team"),
        ]);

        if (teamsRes.ok) {
          const teamsData = await teamsRes.json();
          setTeams(teamsData.teams);
        }

        if (activeTeamRes.ok) {
          const activeData = await activeTeamRes.json();
          setActiveTeamId(activeData.activeTeamId);
        }
      } catch (error) {
        console.error("Failed to load settings data:", error);
      } finally {
        setIsLoadingTeams(false);
      }
    };

    loadData();
  }, []);

  const handleTeamChange = async (value: string) => {
    const newTeamId = value === "none" ? null : value;
    setIsUpdating(true);

    try {
      const response = await fetch("/api/user/active-team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: newTeamId }),
      });

      if (response.ok) {
        setActiveTeamId(newTeamId);
        toast.success(
          newTeamId
            ? "Active team updated"
            : "Active team cleared"
        );
      } else {
        toast.error("Failed to update active team");
      }
    } catch (error) {
      console.error("Failed to update active team:", error);
      toast.error("Failed to update active team");
    } finally {
      setIsUpdating(false);
    }
  };

  const activeTeam = teams.find((t) => t.id === activeTeamId);
  const canManageActiveTeam = activeTeam && (activeTeam.role === "owner" || activeTeam.role === "admin");

  return (
    <div className="px-4 lg:px-6 space-y-8">
      {/* Appearance Section */}
      <div>
        <h1 className="text-lg font-medium">Appearance</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Choose your preferred appearance settings.
        </p>
        <ModeToggle />
      </div>

      <Separator />

      {/* Team Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <IconUsers className="h-5 w-5" />
          <h2 className="text-lg font-medium">Team</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Set your active team to associate new updates with that team.
        </p>

        {isLoadingTeams ? (
          <div className="space-y-2 max-w-md">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : teams.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You are not a member of any teams yet. Create a team or ask a team
              manager to add you.
            </p>
            <Link href="/admin/teams">
              <Button variant="outline" size="sm" className="gap-2">
                <IconSettings className="h-4 w-4" />
                Go to Team Management
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4 max-w-md">
            <div className="space-y-2">
              <Label htmlFor="active-team">Active Team</Label>
              <Select
                value={activeTeamId || "none"}
                onValueChange={handleTeamChange}
                disabled={isUpdating}
              >
                <SelectTrigger id="active-team">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                New updates and activities will be associated with this team.
              </p>
            </div>

            {/* Show active team role and manage link */}
            {activeTeam && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Your role:</span>
                  <Badge variant="secondary" className="gap-1">
                    {activeTeam.role === "owner" && <IconCrown className="h-3 w-3" />}
                    {activeTeam.role === "admin" && <IconUserShield className="h-3 w-3" />}
                    {roleLabelMap[activeTeam.role] || activeTeam.role}
                  </Badge>
                </div>
                {canManageActiveTeam && (
                  <Link href={`/admin/teams/${activeTeamId}`}>
                    <Button variant="outline" size="sm" className="gap-2">
                      <IconSettings className="h-4 w-4" />
                      Manage Team
                    </Button>
                  </Link>
                )}
              </div>
            )}

            {!activeTeam && (
              <Link href="/admin/teams">
                <Button variant="outline" size="sm" className="gap-2">
                  <IconSettings className="h-4 w-4" />
                  Team Management
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>

      <Separator />

      <TimezoneSettings />

      <Separator />

      <NotificationSettings />

      <Separator />

      {/* Account Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <IconUser className="h-5 w-5" />
          <h2 className="text-lg font-medium">Account</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Manage your profile, password, two-factor authentication, and sessions.
        </p>
        <Link href="/dashboard/account">
          <Button variant="outline" size="sm" className="gap-2">
            <IconSettings className="h-4 w-4" />
            Account Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}
