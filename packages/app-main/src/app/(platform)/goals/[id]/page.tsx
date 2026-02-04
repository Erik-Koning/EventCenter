"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Textarea } from "@/src/components/ui/textarea";
import { ExpertReviewPanel } from "@/components/goals/ExpertReviewPanel";
import {
  IconTarget,
  IconCalendar,
  IconArrowLeft,
  IconEdit,
  IconTrash,
  IconSend,
  IconLoader2,
  IconTrendingUp,
} from "@tabler/icons-react";
import { toast } from "sonner";

interface Goal {
  id: string;
  title: string;
  description: string;
  status: string;
  targetDate?: string | null;
  councilScore?: number | null;
  councilReviewedAt?: string | null;
  expertSummary?: string | null;
  createdAt: string;
  updatedAt: string;
  expertReviews: Array<{
    id: string;
    expertId: string;
    expertName: string;
    score?: number | null;
    feedback?: string | null;
    reviewContent: string;
    suggestions?: string | null;
    actionItems?: string | null;
    createdAt: string;
  }>;
  goalUpdates: Array<{
    id: string;
    rawText: string;
    parsedData?: string | null;
    sentiment?: string | null;
    momentumScore?: number | null;
    createdAt: string;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Active", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
  paused: { label: "Paused", variant: "outline" },
  draft: { label: "Draft", variant: "outline" },
};

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = params.id as string;

  const [goal, setGoal] = useState<Goal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updateText, setUpdateText] = useState("");
  const [isSubmittingUpdate, setIsSubmittingUpdate] = useState(false);

  const fetchGoal = useCallback(async () => {
    try {
      const response = await fetch(`/api/goals/${goalId}`);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Goal not found");
          router.push("/home");
          return;
        }
        throw new Error("Failed to fetch goal");
      }
      const data = await response.json();
      setGoal(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load goal");
    } finally {
      setIsLoading(false);
    }
  }, [goalId, router]);

  useEffect(() => {
    fetchGoal();
  }, [fetchGoal]);

  const handleSubmitUpdate = useCallback(async () => {
    if (!updateText.trim() || isSubmittingUpdate) return;
    setIsSubmittingUpdate(true);

    try {
      const response = await fetch("/api/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goalId,
          rawText: updateText.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit update");
      }

      toast.success("Update submitted!");
      setUpdateText("");
      fetchGoal(); // Refresh to show new update
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit update");
    } finally {
      setIsSubmittingUpdate(false);
    }
  }, [goalId, updateText, isSubmittingUpdate, fetchGoal]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Are you sure you want to delete this goal?")) return;

    try {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete goal");
      }

      toast.success("Goal deleted");
      router.push("/home");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete goal");
    }
  }, [goalId, router]);

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-8 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="container max-w-4xl py-8">
        <p>Goal not found</p>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[goal.status] || STATUS_CONFIG.draft;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push("/home")}>
          <IconArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <IconEdit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <IconTrash className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Goal Details Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <IconTarget className="h-6 w-6 text-primary" />
              <div>
                <CardTitle className="text-2xl">{goal.title}</CardTitle>
                <CardDescription>
                  Created {formatDate(goal.createdAt)}
                </CardDescription>
              </div>
            </div>
            <Badge variant={statusConfig.variant} className="text-sm">
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <p className="text-muted-foreground">{goal.description}</p>

          {goal.targetDate && (
            <div className="flex items-center gap-2 text-sm">
              <IconCalendar className="h-4 w-4 text-muted-foreground" />
              <span>Target: {formatDate(goal.targetDate)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expert Review Panel */}
      <ExpertReviewPanel
        goalId={goal.id}
        councilScore={goal.councilScore ? Number(goal.councilScore) : null}
        expertSummary={goal.expertSummary}
        expertReviews={goal.expertReviews}
        onReviewComplete={fetchGoal}
      />

      {/* Submit Update */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconTrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Log Progress</CardTitle>
          </div>
          <CardDescription>
            Share what you've accomplished or any challenges you're facing
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="relative">
            <Textarea
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              placeholder="What progress have you made? Any blockers or insights to share?"
              className="min-h-[100px] pb-12"
              disabled={isSubmittingUpdate}
            />
            <div className="absolute bottom-3 right-3">
              <Button
                size="sm"
                onClick={handleSubmitUpdate}
                disabled={updateText.trim().length < 5 || isSubmittingUpdate}
              >
                {isSubmittingUpdate ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconSend className="mr-2 h-4 w-4" />
                )}
                Submit Update
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Previous Updates */}
      {goal.goalUpdates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Updates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {goal.goalUpdates.map((update) => {
              const parsed = update.parsedData as { summary?: string; activities?: Array<Record<string, unknown>> } | null;

              return (
                <div
                  key={update.id}
                  className="border-l-2 border-primary/30 pl-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatDate(update.createdAt)}
                    </span>
                    {update.momentumScore && (
                      <Badge variant="outline" className="text-xs">
                        Momentum: {update.momentumScore}/10
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{update.rawText}</p>
                  {parsed?.summary && (
                    <p className="text-xs text-muted-foreground italic">
                      AI Summary: {parsed.summary}
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
