"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";
import {
  IconFlask,
  IconPresentation,
  IconUsers,
  IconMicrophone2,
  IconHeart,
  IconCheck,
  IconChecklist,
  IconBook,
  IconNetwork,
} from "@tabler/icons-react";
import { cn } from "@/src/lib/utils";

export interface ExtractedActivity {
  id: string;
  activityType: string;
  quantity: number;
  summary: string;
  activityDate: string;
}

interface ExtractedActivitiesPreviewProps {
  activities: ExtractedActivity[];
  rawSummary: string;
  className?: string;
}

const activityConfig: Record<
  string,
  { label: string; icon: typeof IconFlask; color: string }
> = {
  experiments: {
    label: "Experiments",
    icon: IconFlask,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  product_demos: {
    label: "Product Demos",
    icon: IconPresentation,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  },
  mentoring: {
    label: "Mentoring",
    icon: IconUsers,
    color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
  presentations: {
    label: "Presentations",
    icon: IconMicrophone2,
    color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  volunteering: {
    label: "Volunteering",
    icon: IconHeart,
    color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  },
  general_task: {
    label: "General Task",
    icon: IconChecklist,
    color: "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300",
  },
  research_learning: {
    label: "Research & Learning",
    icon: IconBook,
    color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  },
  networking: {
    label: "Networking",
    icon: IconNetwork,
    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  },
};

export function ExtractedActivitiesPreview({
  activities,
  rawSummary,
  className,
}: ExtractedActivitiesPreviewProps) {
  if (activities.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            No trackable activities were found in your update.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Try mentioning experiments, demos, mentoring, presentations, or volunteering.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group activities by type for summary
  const summary = activities.reduce(
    (acc, activity) => {
      acc[activity.activityType] =
        (acc[activity.activityType] || 0) + Math.round(Number(activity.quantity));
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary badges */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <IconCheck className="h-4 w-4 text-green-600" />
            Activities Extracted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(summary).map(([type, count]) => {
              const config = activityConfig[type];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <Badge
                  key={type}
                  variant="secondary"
                  className={cn("gap-1.5 py-1.5 px-3", config.color)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {count} {config.label}
                </Badge>
              );
            })}
          </div>
          <p className="text-sm text-muted-foreground">{rawSummary}</p>
        </CardContent>
      </Card>

      {/* Detailed activities */}
      <div className="space-y-2">
        {activities.map((activity, index) => {
          const config = activityConfig[activity.activityType];
          if (!config) return null;
          const Icon = config.icon;
          return (
            <Card key={activity.id || index} className="py-3">
              <CardContent className="flex items-start gap-3 px-4">
                <div
                  className={cn(
                    "rounded-lg p-2 shrink-0",
                    config.color
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">
                      {config.label}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      x{Math.round(Number(activity.quantity))}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {activity.summary}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(activity.activityDate).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
