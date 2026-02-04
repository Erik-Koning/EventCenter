"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Button } from "@common/components/ui/Button";
import { Badge } from "@/src/components/ui/badge";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Separator } from "@/src/components/ui/separator";
import {
  IconFlask,
  IconPresentation,
  IconUsers,
  IconMicrophone2,
  IconHeart,
  IconChecklist,
  IconBook,
  IconNetwork,
  IconFlame,
  IconCalendar,
  IconBell,
  IconTrendingUp,
  IconPlus,
  IconChevronRight,
  IconSparkles,
} from "@tabler/icons-react";
import { cn } from "@/src/lib/utils";
import { useUserStore } from "@/lib/stores/userStore";

interface DashboardMetrics {
  streak: {
    current: number;
    longest: number;
    points: number;
  };
  pendingFollowUpsCount: number;
  activitiesThisWeek: number;
  activitiesThisMonth: number;
  activitiesByType: Array<{
    activityType: string;
    count: number;
    totalQuantity: number;
  }>;
  recentUpdates: Array<{
    id: string;
    periodDate: string;
    updatePeriod: string;
    createdAt: string;
    activityCount: number;
  }>;
  topFollowUps: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    activityType: string;
  }>;
  team: {
    id: string;
    name: string;
    memberCount: number;
    monthlyActivities: number;
  } | null;
}

const activityConfig: Record<
  string,
  { label: string; icon: typeof IconFlask; color: string }
> = {
  experiments: {
    label: "Experiments",
    icon: IconFlask,
    color: "text-blue-500",
  },
  product_demos: {
    label: "Demos",
    icon: IconPresentation,
    color: "text-purple-500",
  },
  mentoring: {
    label: "Mentoring",
    icon: IconUsers,
    color: "text-green-500",
  },
  presentations: {
    label: "Presentations",
    icon: IconMicrophone2,
    color: "text-orange-500",
  },
  volunteering: {
    label: "Volunteering",
    icon: IconHeart,
    color: "text-pink-500",
  },
  general_task: {
    label: "Tasks",
    icon: IconChecklist,
    color: "text-slate-500",
  },
  research_learning: {
    label: "Learning",
    icon: IconBook,
    color: "text-cyan-500",
  },
  networking: {
    label: "Networking",
    icon: IconNetwork,
    color: "text-teal-500",
  },
};

export default function DashboardPage() {
  const { user } = useUserStore();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/dashboard/metrics");
        if (response.ok) {
          const data = await response.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error("Failed to load dashboard metrics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const getPeriodLabel = (period: string) => {
    const labels: Record<string, string> = {
      morning: "Morning",
      afternoon: "Afternoon",
      evening: "Evening",
      full_day: "Full Day",
    };
    return labels[period] || period;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Welcome Banner */}
      <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
              </h1>
              <p className="text-muted-foreground mt-1">
                Track your progress and stay on top of your goals.
              </p>
            </div>
            <Link href="/update">
              <Button size="lg" className="gap-2">
                <IconPlus className="h-5 w-5" />
                Log Today&apos;s Update
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Activities This Week */}
        <Card>
          <CardContent className="p-6">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-3">
                  <IconTrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold tabular-nums">
                    {metrics?.activitiesThisWeek || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    This Week
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activities This Month */}
        <Card>
          <CardContent className="p-6">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-3">
                  <IconCalendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold tabular-nums">
                    {metrics?.activitiesThisMonth || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    This Month
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Follow-ups */}
        <Card>
          <CardContent className="p-6">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <Link href="/follow-ups" className="block">
                <div className="flex items-center gap-4">
                  <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
                    <IconBell className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <div className="text-3xl font-bold tabular-nums">
                      {metrics?.pendingFollowUpsCount || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Follow-ups
                    </div>
                  </div>
                </div>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Current Streak */}
        <Card>
          <CardContent className="p-6">
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-orange-100 dark:bg-orange-900/30 p-3">
                  <IconFlame className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <div className="text-3xl font-bold tabular-nums">
                    {metrics?.streak.current || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Day Streak
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Updates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconSparkles className="h-5 w-5" />
              Recent Updates
            </CardTitle>
            <CardDescription>
              Your last 5 daily activity updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : metrics?.recentUpdates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No updates yet.</p>
                <Link href="/update">
                  <Button variant="outline" className="mt-4 px-6">
                    Log Your First Update
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {metrics?.recentUpdates.map((update) => (
                  <div
                    key={update.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div>
                      <div className="font-medium">
                        {formatDate(update.periodDate)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getPeriodLabel(update.updatePeriod)} &middot;{" "}
                        {update.activityCount} activities
                      </div>
                    </div>
                    <Badge variant="secondary">{update.activityCount}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Follow-ups Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <IconBell className="h-5 w-5" />
                  Pending Follow-ups
                </CardTitle>
                <CardDescription>
                  Upcoming reminders from your activities
                </CardDescription>
              </div>
              <Link href="/follow-ups">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <IconChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : metrics?.topFollowUps.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No pending follow-ups.</p>
                <p className="text-sm mt-1">You&apos;re all caught up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {metrics?.topFollowUps.map((followUp) => {
                  const config = activityConfig[followUp.activityType];
                  const Icon = config?.icon || IconChecklist;
                  return (
                    <div
                      key={followUp.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <Icon
                        className={cn("h-5 w-5", config?.color || "text-muted-foreground")}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {followUp.title}
                        </div>
                        {followUp.dueDate && (
                          <div
                            className={cn(
                              "text-xs",
                              isOverdue(followUp.dueDate)
                                ? "text-red-500"
                                : "text-muted-foreground"
                            )}
                          >
                            Due: {formatDate(followUp.dueDate)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Summary */}
      {(isLoading || metrics?.team) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconUsers className="h-5 w-5" />
              Team Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : metrics?.team ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{metrics.team.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {metrics.team.memberCount} members
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold tabular-nums">
                    {metrics.team.monthlyActivities}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Team activities this month
                  </div>
                </div>
                <Link href={`/admin/teams/${metrics.team.id}/stats`}>
                  <Button variant="outline" className="gap-1">
                    View Stats
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Activity Breakdown This Month */}
      {(isLoading || (metrics?.activitiesByType && metrics.activitiesByType.length > 0)) && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Breakdown</CardTitle>
            <CardDescription>Your activities by type this month</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-4">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
                {Object.entries(activityConfig).map(([key, config]) => {
                  const data = metrics?.activitiesByType.find(
                    (a) => a.activityType === key
                  );
                  const Icon = config.icon;
                  return (
                    <div
                      key={key}
                      className="flex flex-col items-center p-4 rounded-lg border bg-card"
                    >
                      <Icon className={cn("h-8 w-8 mb-2", config.color)} />
                      <div className="text-2xl font-bold tabular-nums">
                        {data?.count || 0}
                      </div>
                      <div className="text-xs text-muted-foreground text-center">
                        {config.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
