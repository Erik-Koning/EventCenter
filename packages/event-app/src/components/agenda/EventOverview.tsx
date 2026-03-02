import { EVENT_INFO } from "@/data/event";
import { SPEAKERS } from "@/data/speakers";

export function EventOverview() {
  const featuredSpeakers = SPEAKERS.slice(0, 4);

  return (
    <section className="mb-10 rounded-2xl border border-border bg-gradient-to-br from-primary/[0.03] to-transparent p-8">
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-primary">
          {EVENT_INFO.venue} &middot; {EVENT_INFO.location}
        </p>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          {EVENT_INFO.name}
        </h2>
        <p className="mt-1 text-lg font-medium text-muted-foreground">
          {EVENT_INFO.tagline}
        </p>
      </div>

      <p className="mb-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        {EVENT_INFO.purpose}
      </p>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Featured Speakers
        </p>
        <div className="flex items-center gap-3">
          {featuredSpeakers.map((speaker) => (
            <div key={speaker.id} className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {speaker.initials}
              </div>
              <div>
                <p className="text-xs font-medium text-foreground">
                  {speaker.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {speaker.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
