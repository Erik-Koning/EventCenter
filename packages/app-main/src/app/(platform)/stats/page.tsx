"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@common/components/ui/Button";
import { Skeleton } from "@/src/components/ui/skeleton";
import { YearSelector } from "@/components/admin/teams/YearSelector";
import {
  IconFlask,
  IconPresentation,
  IconUsers,
  IconMicrophone2,
  IconHeart,
  IconTrendingUp,
  IconChecklist,
  IconBook,
  IconDownload,
  IconChartBar,
  IconNetwork,
} from "@tabler/icons-react";
import { cn } from "@/src/lib/utils";
import * as XLSX from "xlsx";
import { toast } from "@common/components/ui/sonner";

interface MonthlyStats {
  month: number;
  experiments: number;
  product_demos: number;
  mentoring: number;
  presentations: number;
  volunteering: number;
  general_task: number;
  research_learning: number;
  networking: number;
  total: number;
}

interface RecentActivity {
  id: string;
  activityType: string;
  quantity: number;
  summary: string;
  activityDate: string;
}

interface PersonalStats {
  userId: string;
  userName: string;
  hasActiveTeam: boolean;
  year: number;
  monthlyStats: MonthlyStats[];
  yearlyTotal: {
    experiments: number;
    product_demos: number;
    mentoring: number;
    presentations: number;
    volunteering: number;
    general_task: number;
    research_learning: number;
    networking: number;
    total: number;
  };
  recentActivities: RecentActivity[];
  activityCount: number;
}

const categoryConfig = [
  {
    key: "experiments",
    label: "Experiments",
    icon: IconFlask,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  {
    key: "product_demos",
    label: "Product Demos",
    icon: IconPresentation,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  {
    key: "mentoring",
    label: "Mentoring",
    icon: IconUsers,
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  {
    key: "presentations",
    label: "Presentations",
    icon: IconMicrophone2,
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  {
    key: "volunteering",
    label: "Volunteering",
    icon: IconHeart,
    color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  },
  {
    key: "general_task",
    label: "General Tasks",
    icon: IconChecklist,
    color: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
  },
  {
    key: "research_learning",
    label: "Research & Learning",
    icon: IconBook,
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  },
  {
    key: "networking",
    label: "Networking",
    icon: IconNetwork,
    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  },
] as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PersonalStatsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<PersonalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [year]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/stats/personal?year=${year}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!stats) return;

    try {
      const wb = XLSX.utils.book_new();

      // Monthly breakdown sheet - activities as rows, months as columns
      const monthlyData = categoryConfig.map((cat) => {
        const row: Record<string, string | number> = {
          Activity: cat.label,
        };
        MONTHS.forEach((month, idx) => {
          row[month] = stats.monthlyStats[idx][cat.key as keyof MonthlyStats] as number || 0;
        });
        row["Year Total"] = stats.yearlyTotal[cat.key as keyof typeof stats.yearlyTotal] || 0;
        return row;
      });

      // Add monthly totals row
      const totalRow: Record<string, string | number> = {
        Activity: "MONTHLY TOTAL",
      };
      MONTHS.forEach((month, idx) => {
        totalRow[month] = stats.monthlyStats[idx].total;
      });
      totalRow["Year Total"] = stats.yearlyTotal.total;
      monthlyData.push(totalRow);

      const monthlyWs = XLSX.utils.json_to_sheet(monthlyData);
      XLSX.utils.book_append_sheet(wb, monthlyWs, "Monthly Breakdown");

      // Recent activities sheet
      if (stats.recentActivities.length > 0) {
        const activitiesData = stats.recentActivities.map((a) => ({
          Date: new Date(a.activityDate).toLocaleDateString(),
          Type: categoryConfig.find((c) => c.key === a.activityType)?.label || a.activityType,
          Quantity: a.quantity,
          Summary: a.summary,
        }));
        const activitiesWs = XLSX.utils.json_to_sheet(activitiesData);
        XLSX.utils.book_append_sheet(wb, activitiesWs, "Recent Activities");
      }

      // Summary sheet
      const summaryData: { Activity: string; "Year Total": number }[] = categoryConfig.map((cat) => ({
        Activity: cat.label,
        "Year Total": stats.yearlyTotal[cat.key as keyof typeof stats.yearlyTotal] || 0,
      }));
      summaryData.push({
        Activity: "GRAND TOTAL",
        "Year Total": stats.yearlyTotal.total,
      });
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      // Generate filename and download
      const filename = `Personal_Stats_${year}.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success("Report exported successfully");
    } catch (error) {
      console.error("Failed to export:", error);
      toast.error("Failed to export report");
    }
  };

  return (
    <div className="container py-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <IconChartBar className="h-7 w-7 text-primary" />
            My Statistics
          </h1>
          <p className="text-muted-foreground mt-1">
            Personal activities not assigned to any team
          </p>
          {stats?.hasActiveTeam && (
            <p className="text-sm text-muted-foreground mt-2">
              You have an active team. Team-assigned activities are shown in{" "}
              <Link href="/admin/teams" className="text-primary hover:underline">
                Team Stats
              </Link>.
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Year:</span>
          <YearSelector value={year} onChange={setYear} />
          <Button
            variant="outline"
            className="gap-2"
            onClick={exportToExcel}
            disabled={isLoading || !stats}
          >
            <IconDownload className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-8 w-12 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardContent className="p-6">
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Category Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
            {categoryConfig.map((cat) => {
              const Icon = cat.icon;
              const value = stats.yearlyTotal[cat.key as keyof typeof stats.yearlyTotal];
              return (
                <Card key={cat.key}>
                  <CardContent className="p-4">
                    <div className="flex flex-col items-center text-center">
                      <div className={cn("rounded-lg p-2 mb-2", cat.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-2xl font-bold tabular-nums">
                        {value}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {cat.label}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Year Summary Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <IconTrendingUp className="h-5 w-5 text-primary" />
                    {year} Summary
                  </CardTitle>
                  <CardDescription>
                    Personal activities (not assigned to any team)
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-1">
                  {stats.yearlyTotal.total} Total Activities
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Monthly Breakdown Table - Activities as rows, Months as columns */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Breakdown</CardTitle>
              <CardDescription>
                Activity counts by category and month
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.yearlyTotal.total === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No personal activities recorded for {year}.</p>
                  <p className="text-sm mt-1">
                    Activities assigned to a team are tracked in Team Stats.
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left p-3 font-medium min-w-[140px]">Activity</th>
                        {MONTHS.map((month) => (
                          <th key={month} className="text-center p-2 font-medium text-xs">
                            {month}
                          </th>
                        ))}
                        <th className="text-center p-3 font-medium bg-muted/80">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryConfig.map((cat) => {
                        const Icon = cat.icon;
                        const yearTotal = stats.yearlyTotal[cat.key as keyof typeof stats.yearlyTotal];
                        return (
                          <tr key={cat.key} className="border-t">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <div className={cn("rounded p-1.5", cat.color)}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <span className="font-medium text-sm">{cat.label}</span>
                              </div>
                            </td>
                            {MONTHS.map((month, idx) => {
                              const value = stats.monthlyStats[idx][cat.key as keyof MonthlyStats] as number;
                              return (
                                <td
                                  key={month}
                                  className={cn(
                                    "text-center p-2 tabular-nums text-sm",
                                    value === 0 ? "text-muted-foreground/40" : ""
                                  )}
                                >
                                  {value || "-"}
                                </td>
                              );
                            })}
                            <td className="text-center p-3 tabular-nums font-semibold bg-muted/30">
                              {yearTotal}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 bg-muted/30 font-semibold">
                        <td className="p-3">Monthly Total</td>
                        {MONTHS.map((month, idx) => (
                          <td key={month} className="text-center p-2 tabular-nums text-primary text-sm">
                            {stats.monthlyStats[idx].total}
                          </td>
                        ))}
                        <td className="text-center p-3 tabular-nums text-primary bg-primary/10">
                          {stats.yearlyTotal.total}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activities */}
          {stats.recentActivities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activities</CardTitle>
                <CardDescription>
                  Last {stats.recentActivities.length} personal activities in {year}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {stats.recentActivities.map((activity) => {
                    const config = categoryConfig.find((c) => c.key === activity.activityType);
                    const Icon = config?.icon || IconChecklist;
                    return (
                      <div
                        key={activity.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div className={cn("rounded-lg p-2", config?.color || "bg-slate-100")}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{activity.summary}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.activityDate).toLocaleDateString()} &middot; x{Math.round(Number(activity.quantity))}
                          </p>
                        </div>
                        <Badge variant="secondary" className={cn("text-xs", config?.color)}>
                          {config?.label || activity.activityType}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Failed to load statistics. Please try again.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
