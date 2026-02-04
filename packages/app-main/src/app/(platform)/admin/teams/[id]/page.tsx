"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@common/components/ui/Button";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { AddMemberDialog } from "@/components/admin/teams/AddMemberDialog";
import { InviteMemberDialog } from "@/components/admin/teams/InviteMemberDialog";
import { TeamMembersList } from "@/components/admin/teams/TeamMembersList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/src/components/ui/alert-dialog";
import {
  IconArrowLeft,
  IconTrash,
  IconLoader2,
  IconChartBar,
  IconSwitchHorizontal,
} from "@tabler/icons-react";
import { useUserStore } from "@/lib/stores/userStore";

interface TeamMember {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

interface TeamInvitation {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  invitedBy: {
    id: string;
    name: string;
  };
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  members: TeamMember[];
  invitations: TeamInvitation[];
}

interface ManageableTeam {
  id: string;
  name: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function TeamDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useUserStore();
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [manageableTeams, setManageableTeams] = useState<ManageableTeam[]>([]);

  // Get current user's role in this team
  const currentUserRole = team?.members.find(
    (m) => m.user.id === user?.id
  )?.role;

  const loadTeam = async () => {
    try {
      const response = await fetch(`/api/admin/teams/${id}`);
      if (response.ok) {
        const data = await response.json();
        setTeam(data);
      } else if (response.status === 404 || response.status === 403) {
        router.push("/admin/teams");
      }
    } catch (error) {
      console.error("Failed to load team:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadManageableTeams = async () => {
    try {
      const response = await fetch("/api/admin/teams");
      if (response.ok) {
        const data = await response.json();
        setManageableTeams(
          data.teams.map((t: ManageableTeam) => ({ id: t.id, name: t.name }))
        );
      }
    } catch (error) {
      console.error("Failed to load manageable teams:", error);
    }
  };

  useEffect(() => {
    loadTeam();
    loadManageableTeams();
  }, [id]);

  const handleDeleteTeam = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/teams/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.push("/admin/teams");
      }
    } catch (error) {
      console.error("Failed to delete team:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTeamSwitch = (newTeamId: string) => {
    if (newTeamId !== id) {
      router.push(`/admin/teams/${newTeamId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <Card>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!team) {
    return null;
  }

  const existingMemberIds = team.members.map((m) => m.user.id);
  const isOwner = currentUserRole === "owner";

  return (
    <div className="container py-8">
      {/* Back link */}
      <Link
        href="/admin/teams"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <IconArrowLeft className="h-4 w-4" />
        Back to Teams
      </Link>

      {/* Team Switcher */}
      {manageableTeams.length > 1 && (
        <div className="flex items-center gap-2 mb-6">
          <IconSwitchHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select value={id} onValueChange={handleTeamSwitch}>
            <SelectTrigger className="w-[250px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {manageableTeams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{team.name}</h1>
          {team.description && (
            <p className="text-muted-foreground mt-1">{team.description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-2">
            Created {new Date(team.createdAt).toLocaleDateString()} by{" "}
            {team.createdBy.name}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/admin/teams/${id}/stats`}>
            <Button variant="outline" className="gap-2">
              <IconChartBar className="h-4 w-4" />
              View Stats
            </Button>
          </Link>

          {isOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2" disabled={isDeleting}>
                  {isDeleting ? (
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <IconTrash className="h-4 w-4" />
                  )}
                  Delete Team
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Team</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &quot;{team.name}&quot;? This action cannot be
                    undone. All team members will be removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteTeam}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Members Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage who has access to this team
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <AddMemberDialog
                teamId={id}
                existingMemberIds={existingMemberIds}
                onMemberAdded={loadTeam}
              />
              <InviteMemberDialog teamId={id} onInviteSent={loadTeam} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <TeamMembersList
            teamId={id}
            members={team.members}
            invitations={team.invitations}
            currentUserRole={currentUserRole}
            onMemberRemoved={loadTeam}
            onInvitationCancelled={loadTeam}
            onRoleChanged={loadTeam}
          />
        </CardContent>
      </Card>
    </div>
  );
}
