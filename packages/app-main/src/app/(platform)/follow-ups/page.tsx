"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Checkbox } from "@/src/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { Separator } from "@/src/components/ui/separator";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  IconFlask,
  IconPresentation,
  IconUsers,
  IconMicrophone2,
  IconHeart,
  IconChecklist,
  IconBook,
  IconNetwork,
  IconExternalLink,
  IconLoader2,
  IconCheck,
  IconX,
  IconRefresh,
  IconDotsVertical,
  IconCalendar,
  IconPencil,
} from "@tabler/icons-react";
import { cn } from "@/src/lib/utils";
import { toast } from "@common/components/ui/sonner";
import FollowUpEditDialog from "@/components/updates/FollowUpEditDialog";

interface FollowUp {
  id: string;
  title: string;
  summary: string;
  status: string;
  activityType: string | null;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  linkedEventId: string | null;
  chatSession: {
    id: string;
    sessionId: string;
    periodDate: string;
  };
  extractedActivity: {
    id: string;
    activityType: string;
    summary: string;
    quantity: number;
  };
  team: { id: string; name: string } | null;
}

const activityConfig: Record<
  string,
  { label: string; icon: typeof IconFlask; color: string }
> = {
  experiments: {
    label: "Experiment",
    icon: IconFlask,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  product_demos: {
    label: "Demo",
    icon: IconPresentation,
    color:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  mentoring: {
    label: "Mentoring",
    icon: IconUsers,
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  presentations: {
    label: "Presentation",
    icon: IconMicrophone2,
    color:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  volunteering: {
    label: "Volunteering",
    icon: IconHeart,
    color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  },
  general_task: {
    label: "Task",
    icon: IconChecklist,
    color:
      "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
  },
  research_learning: {
    label: "Learning",
    icon: IconBook,
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  },
  networking: {
    label: "Networking",
    icon: IconNetwork,
    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  },
};

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof IconCheck }
> = {
  confirmed: {
    label: "Pending",
    color:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    icon: IconCalendar,
  },
  completed: {
    label: "Completed",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    icon: IconCheck,
  },
  dismissed: {
    label: "Dismissed",
    color:
      "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
    icon: IconX,
  },
};

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("confirmed");
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("dueDate");
  const [sortOrder, setSortOrder] = useState<string>("asc");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);

  const fetchFollowUps = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") {
        params.set("status", statusFilter);
      } else if (statusFilter === "all") {
        params.set("status", "confirmed,completed,dismissed");
      }
      if (activityTypeFilter && activityTypeFilter !== "all") {
        params.set("activityType", activityTypeFilter);
      }
      params.set("sortBy", sortBy);
      params.set("sortOrder", sortOrder);
      params.set("limit", "100");

      const response = await fetch(`/api/updates/follow-ups?${params}`);
      if (!response.ok) throw new Error("Failed to fetch follow-ups");

      const data = await response.json();
      setFollowUps(data.followUps);
    } catch (error) {
      console.error("Error fetching follow-ups:", error);
      toast.error("Failed to load follow-ups");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, activityTypeFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  const updateFollowUp = async (
    id: string,
    status: "confirmed" | "completed" | "dismissed"
  ) => {
    setIsUpdating(true);
    try {
      const response = await fetch("/api/updates/follow-ups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followUpId: id, status }),
      });

      if (!response.ok) throw new Error("Failed to update follow-up");

      toast.success(
        status === "completed"
          ? "Follow-up completed"
          : status === "dismissed"
            ? "Follow-up dismissed"
            : "Follow-up reopened"
      );
      fetchFollowUps();
    } catch (error) {
      console.error("Error updating follow-up:", error);
      toast.error("Failed to update follow-up");
    } finally {
      setIsUpdating(false);
    }
  };

  const bulkUpdate = async (status: "confirmed" | "completed" | "dismissed") => {
    if (selectedIds.size === 0) return;

    setIsUpdating(true);
    try {
      const response = await fetch("/api/updates/follow-ups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          followUpIds: Array.from(selectedIds),
          status,
        }),
      });

      if (!response.ok) throw new Error("Failed to update follow-ups");

      toast.success(`Updated ${selectedIds.size} follow-ups`);
      setSelectedIds(new Set());
      fetchFollowUps();
    } catch (error) {
      console.error("Error updating follow-ups:", error);
      toast.error("Failed to update follow-ups");
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === followUps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(followUps.map((fu) => fu.id)));
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Follow-ups</h1>
        <p className="text-muted-foreground">
          Manage your follow-up reminders from daily updates
        </p>
      </div>

      <Separator className="mb-6" />

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="confirmed">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Type:</span>
          <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(activityConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dueDate">Due Date</SelectItem>
              <SelectItem value="createdAt">Created</SelectItem>
              <SelectItem value="title">Title</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortOrder} onValueChange={setSortOrder}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">Asc</SelectItem>
              <SelectItem value="desc">Desc</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" onClick={fetchFollowUps}>
          <IconRefresh className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkUpdate("completed")}
            disabled={isUpdating}
          >
            <IconCheck className="h-4 w-4 mr-1" />
            Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkUpdate("dismissed")}
            disabled={isUpdating}
          >
            <IconX className="h-4 w-4 mr-1" />
            Dismiss
          </Button>
          {statusFilter !== "confirmed" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => bulkUpdate("confirmed")}
              disabled={isUpdating}
            >
              <IconRefresh className="h-4 w-4 mr-1" />
              Reopen
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : followUps.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No follow-ups found</p>
          <p className="text-sm mt-1">
            {statusFilter === "confirmed"
              ? "You're all caught up!"
              : "Try adjusting your filters"}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      selectedIds.size === followUps.length &&
                      followUps.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {followUps.map((followUp) => {
                const actConfig =
                  activityConfig[followUp.extractedActivity.activityType];
                const ActIcon = actConfig?.icon || IconChecklist;
                const statConfig = statusConfig[followUp.status];

                return (
                  <TableRow
                    key={followUp.id}
                    className={cn(
                      selectedIds.has(followUp.id) && "bg-muted/50"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(followUp.id)}
                        onCheckedChange={() => toggleSelection(followUp.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{followUp.title}</span>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {followUp.summary}
                        </span>
                        {followUp.team && (
                          <Badge variant="outline" className="w-fit text-xs">
                            {followUp.team.name}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {actConfig && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs py-0 px-1.5 gap-1",
                            actConfig.color
                          )}
                        >
                          <ActIcon className="h-3 w-3" />
                          {actConfig.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={cn("text-xs", statConfig?.color)}
                      >
                        {statConfig?.label || followUp.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          followUp.status === "confirmed" &&
                            isOverdue(followUp.dueDate) &&
                            "text-red-500 font-medium"
                        )}
                      >
                        {formatDate(followUp.dueDate)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(followUp.createdAt)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            {isUpdating ? (
                              <IconLoader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <IconDotsVertical className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditingFollowUp(followUp)}
                          >
                            <IconPencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {followUp.status === "confirmed" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateFollowUp(followUp.id, "completed")
                                }
                              >
                                <IconCheck className="h-4 w-4 mr-2" />
                                Complete
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateFollowUp(followUp.id, "dismissed")
                                }
                              >
                                <IconX className="h-4 w-4 mr-2" />
                                Dismiss
                              </DropdownMenuItem>
                            </>
                          )}
                          {followUp.status !== "confirmed" && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateFollowUp(followUp.id, "confirmed")
                              }
                            >
                              <IconRefresh className="h-4 w-4 mr-2" />
                              Reopen
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <a
                              href={`/update/history?session=${followUp.chatSession.sessionId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <IconExternalLink className="h-4 w-4 mr-2" />
                              View Session
                            </a>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Dialog */}
      {editingFollowUp && (
        <FollowUpEditDialog
          followUp={editingFollowUp}
          open={!!editingFollowUp}
          onOpenChange={(open) => {
            if (!open) setEditingFollowUp(null);
          }}
          onSaved={fetchFollowUps}
        />
      )}
    </div>
  );
}
