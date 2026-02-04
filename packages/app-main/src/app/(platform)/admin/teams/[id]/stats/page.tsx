"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@common/components/ui/Button";
import { Skeleton } from "@/src/components/ui/skeleton";
import { YearSelector } from "@/components/admin/teams/YearSelector";
import {
  IconArrowLeft,
  IconFlask,
  IconPresentation,
  IconUsers,
  IconMicrophone2,
  IconHeart,
  IconTrendingUp,
  IconChecklist,
  IconBook,
  IconDownload,
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

interface MemberStats {
  userId: string;
  userName: string;
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
}

interface TeamStats {
  teamId: string;
  teamName: string;
  year: number;
  members: MemberStats[];
  teamTotals: {
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
  monthlyTeamTotals: MonthlyStats[];
}

interface PageProps {
  params: Promise<{ id: string }>;
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

export default function TeamStatsPage({ params }: PageProps) {
  const { id } = use(params);
  const [year, setYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, [id, year]);

  const loadStats = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/teams/${id}/stats?year=${year}`);
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

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const exportToExcel = () => {
    if (!stats) return;

    try {
      const wb = XLSX.utils.book_new();

      // Create sheet for each activity type
      categoryConfig.forEach((cat) => {
        const data = stats.members.map((member) => {
          const row: Record<string, string | number> = {
            "Team Member": member.userName,
          };

          // Add each month
          MONTHS.forEach((month, idx) => {
            const monthStats = member.monthlyStats.find((ms) => ms.month === idx + 1);
            row[month] = monthStats
              ? monthStats[cat.key as keyof MonthlyStats] as number || 0
              : 0;
          });

          // Add year total
          row["Year Total"] = member.yearlyTotal[cat.key as keyof typeof member.yearlyTotal] || 0;

          return row;
        });

        // Add team totals row
        const teamTotalRow: Record<string, string | number> = {
          "Team Member": "TEAM TOTAL",
        };
        MONTHS.forEach((month, idx) => {
          const monthStats = stats.monthlyTeamTotals.find((ms) => ms.month === idx + 1);
          teamTotalRow[month] = monthStats
            ? monthStats[cat.key as keyof MonthlyStats] as number || 0
            : 0;
        });
        teamTotalRow["Year Total"] = stats.teamTotals[cat.key as keyof typeof stats.teamTotals] || 0;
        data.push(teamTotalRow);

        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, cat.label.slice(0, 31)); // Sheet name max 31 chars
      });

      // Create Summary sheet
      const summaryData = stats.members.map((member) => {
        const row: Record<string, string | number> = {
          "Team Member": member.userName,
        };
        categoryConfig.forEach((cat) => {
          row[cat.label] = member.yearlyTotal[cat.key as keyof typeof member.yearlyTotal] || 0;
        });
        row["Grand Total"] = member.yearlyTotal.total;
        return row;
      });

      // Add team totals to summary
      const teamSummaryRow: Record<string, string | number> = {
        "Team Member": "TEAM TOTAL",
      };
      categoryConfig.forEach((cat) => {
        teamSummaryRow[cat.label] = stats.teamTotals[cat.key as keyof typeof stats.teamTotals] || 0;
      });
      teamSummaryRow["Grand Total"] = stats.teamTotals.total;
      summaryData.push(teamSummaryRow);

      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

      // Generate filename and download
      const filename = `${stats.teamName.replace(/[^a-z0-9]/gi, "_")}_${year}_stats.xlsx`;
      XLSX.writeFile(wb, filename);

      toast.success("Report exported successfully");
    } catch (error) {
      console.error("Failed to export:", error);
      toast.error("Failed to export report");
    }
  };

  return (
    <div className="container py-8">
      {/* Back link */}
      <Link
        href={`/admin/teams/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <IconArrowLeft className="h-4 w-4" />
        Back to Team
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">
            {isLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              `${stats?.teamName || "Team"} Statistics`
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Monthly activity breakdown by member
          </p>
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
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i} className="min-w-[160px]">
                <CardContent className="p-4">
                  <Skeleton className="h-8 w-12 mb-2" />
                  <Skeleton className="h-4 w-24" />
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
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {categoryConfig.map((cat) => {
              const Icon = cat.icon;
              const value = stats.teamTotals[cat.key as keyof typeof stats.teamTotals];
              return (
                <Card key={cat.key} className="min-w-[160px]">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("rounded-lg p-2", cat.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-2xl font-bold tabular-nums">
                          {value}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {cat.label}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Team Total Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <IconTrendingUp className="h-5 w-5 text-primary" />
                    {year} Summary
                  </CardTitle>
                  <CardDescription>
                    {stats.members.length} team members
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-lg px-4 py-1">
                  {stats.teamTotals.total} Total Activities
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Activity Cards - One card per activity type with members as rows, months as columns */}
          {stats.members.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No members in this team yet.
              </CardContent>
            </Card>
          ) : (
            categoryConfig.map((cat) => {
              const Icon = cat.icon;
              const categoryTotal = stats.teamTotals[cat.key as keyof typeof stats.teamTotals];

              // Skip empty categories
              if (categoryTotal === 0) return null;

              return (
                <Card key={cat.key}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <div className={cn("rounded-lg p-2", cat.color)}>
                          <Icon className="h-5 w-5" />
                        </div>
                        {cat.label}
                      </CardTitle>
                      <Badge variant="secondary" className="text-sm px-3 py-1">
                        {categoryTotal} Total
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-muted/50">
                            <th className="text-left p-3 font-medium min-w-[140px]">Member</th>
                            {MONTHS.map((month) => (
                              <th key={month} className="text-center p-2 font-medium text-xs">
                                {month}
                              </th>
                            ))}
                            <th className="text-center p-3 font-medium bg-muted/80">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.members.map((member) => {
                            const memberTotal = member.yearlyTotal[cat.key as keyof typeof member.yearlyTotal];
                            return (
                              <tr key={member.userId} className="border-t">
                                <td className="p-3 font-medium text-sm">{member.userName}</td>
                                {MONTHS.map((month, idx) => {
                                  const monthStats = member.monthlyStats.find((ms) => ms.month === idx + 1);
                                  const value = monthStats ? monthStats[cat.key as keyof MonthlyStats] as number : 0;
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
                                  {memberTotal}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="border-t-2 bg-muted/30 font-semibold">
                            <td className="p-3">Team Total</td>
                            {MONTHS.map((month, idx) => {
                              const monthStats = stats.monthlyTeamTotals.find((ms) => ms.month === idx + 1);
                              const value = monthStats ? monthStats[cat.key as keyof MonthlyStats] as number : 0;
                              return (
                                <td key={month} className="text-center p-2 tabular-nums text-primary text-sm">
                                  {value || "-"}
                                </td>
                              );
                            })}
                            <td className="text-center p-3 tabular-nums text-primary bg-primary/10">
                              {categoryTotal}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })
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
