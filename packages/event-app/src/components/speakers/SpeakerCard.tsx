import type { Speaker } from "@/data/types";

interface SpeakerCardProps {
  speaker: Speaker;
}

export function SpeakerCard({ speaker }: SpeakerCardProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
      {/* Avatar */}
      <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-primary/10 ring-4 ring-primary/5">
        <span className="text-3xl font-semibold text-primary">
          {speaker.initials}
        </span>
      </div>

      {/* Name & Title */}
      <h3 className="text-2xl font-semibold tracking-tight text-foreground">
        {speaker.name}
      </h3>
      <p className="mt-1 text-sm font-medium text-primary">{speaker.title}</p>
      <p className="text-xs text-muted-foreground">{speaker.company}</p>

      {/* Bio */}
      <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">
        {speaker.bio}
      </p>
    </div>
  );
}
