import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { events, eventSessions, eventAttendees } from "@/db/schema";

export interface EventContext {
  event: {
    id: string;
    title: string;
    description: string | null;
    startDate: string;
    endDate: string;
    venue: string | null;
    location: string | null;
  };
  sessions: {
    id: string;
    title: string;
    description: string | null;
    date: string;
    startTime: string;
    endTime: string;
    location: string | null;
    track: string | null;
    tags: string[];
    speakers: { name: string; title: string | null; company: string | null; bio: string | null }[];
  }[];
}

interface CacheEntry {
  data: EventContext;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

export async function getEventContext(eventId: string): Promise<EventContext | null> {
  const now = Date.now();

  const cached = cache.get(eventId);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) return null;

  const sessions = await db.query.eventSessions.findMany({
    where: eq(eventSessions.eventId, eventId),
    with: {
      sessionSpeakers: {
        with: { user: true },
      },
    },
  });

  // Build a map of userId → bio from eventAttendees for this event
  const enrollments = await db.query.eventAttendees.findMany({
    where: eq(eventAttendees.eventId, eventId),
    columns: { userId: true, bio: true },
  });
  const bioMap = new Map(enrollments.map((e) => [e.userId, e.bio]));

  const context: EventContext = {
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      venue: event.venue,
      location: event.location,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location,
      track: s.track,
      tags: (s.tags as string[]) ?? [],
      speakers: s.sessionSpeakers.map((ss) => ({
        name: ss.user.name,
        title: ss.user.title,
        company: ss.user.company,
        bio: bioMap.get(ss.user.id) ?? null,
      })),
    })),
  };

  cache.set(eventId, { data: context, expiresAt: now + CACHE_TTL_MS });

  return context;
}
