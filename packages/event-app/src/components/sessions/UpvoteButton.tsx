"use client";

import { ThumbsUp } from "lucide-react";
import { cn } from "@common/lib/utils";
import { useSessionStore } from "@/lib/stores/sessionStore";

interface UpvoteButtonProps {
  sessionId: string;
}

export function UpvoteButton({ sessionId }: UpvoteButtonProps) {
  const upvotes = useSessionStore((s) => s.upvotes[sessionId] ?? 0);
  const isUpvoted = useSessionStore((s) => !!s.userUpvoted[sessionId]);
  const toggleUpvote = useSessionStore((s) => s.toggleUpvote);

  return (
    <button
      onClick={() => toggleUpvote(sessionId)}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150",
        isUpvoted
          ? "border-primary/30 bg-primary/[0.06] text-primary"
          : "border-border bg-white text-muted-foreground hover:border-primary/20 hover:text-primary"
      )}
    >
      <ThumbsUp
        className={cn("h-3.5 w-3.5", isUpvoted && "fill-primary")}
        strokeWidth={isUpvoted ? 2 : 1.5}
      />
      {upvotes > 0 && <span>{upvotes}</span>}
    </button>
  );
}
