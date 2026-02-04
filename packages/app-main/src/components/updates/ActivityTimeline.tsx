"use client";

import { cn } from "@/lib/utils";
import {
  IconFlask,
  IconPresentation,
  IconUsers,
  IconMicrophone,
  IconHeart,
  IconTarget,
} from "@tabler/icons-react";

interface Activity {
  id: string;
  activityType: string;
  quantity: number;
  summary: string;
  activityDate: string;
  period: string;
  linkedGoal?: {
    id: string;
    goalText: string;
  } | null;
}

interface ActivityTimelineProps {
  activities: Activity[];
  className?: string;
}

const ACTIVITY_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  experiments: {
    icon: IconFlask,
    color: "text-purple-500 bg-purple-500/10",
    label: "Experiment",
  },
  product_demos: {
    icon: IconPresentation,
    color: "text-blue-500 bg-blue-500/10",
    label: "Demo",
  },
  mentoring: {
    icon: IconUsers,
    color: "text-green-500 bg-green-500/10",
    label: "Mentoring",
  },
  presentations: {
    icon: IconMicrophone,
    color: "text-orange-500 bg-orange-500/10",
    label: "Presentation",
  },
  volunteering: {
    icon: IconHeart,
    color: "text-pink-500 bg-pink-500/10",
    label: "Volunteering",
  },
};

export function ActivityTimeline({ activities, className }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <p>No activities extracted yet.</p>
        <p className="text-sm">Submit a daily update to see your activities here.</p>
      </div>
    );
  }

  // Group activities by date
  const groupedByDate = activities.reduce((acc, activity) => {
    const date = new Date(activity.activityDate).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(activity);
    return acc;
  }, {} as Record<string, Activity[]>);

  return (
    <div className={cn("space-y-6", className)}>
      {Object.entries(groupedByDate).map(([date, dateActivities]) => (
        <div key={date}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">{date}</h3>
          <div className="space-y-3">
            {dateActivities.map((activity) => {
              const config = ACTIVITY_CONFIG[activity.activityType] || {
                icon: IconTarget,
                color: "text-gray-500 bg-gray-500/10",
                label: activity.activityType,
              };
              const Icon = config.icon;

              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 rounded-lg border p-4"
                >
                  <div className={cn("rounded-full p-2", config.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{config.label}</span>
                      <span className="text-sm text-muted-foreground">
                        x{Math.round(Number(activity.quantity))}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        ({activity.period})
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {activity.summary}
                    </p>
                    {activity.linkedGoal && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-primary">
                        <IconTarget className="h-3 w-3" />
                        <span className="truncate">{activity.linkedGoal.goalText}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
