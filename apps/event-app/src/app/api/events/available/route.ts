import { NextResponse } from "next/server";
import { and, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/db/schema";
import { requireAuth } from "@/lib/authorization";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.success) return authResult.response;

  try {
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate())
      .toISOString()
      .split("T")[0];
    const maxDate = new Date(now.getFullYear() + 2, now.getMonth(), now.getDate())
      .toISOString()
      .split("T")[0];

    const allEvents = await db
      .select({
        id: events.id,
        title: events.title,
        startDate: events.startDate,
        endDate: events.endDate,
        venue: events.venue,
        location: events.location,
      })
      .from(events)
      .where(
        and(
          gte(events.endDate, minDate),
          lte(events.startDate, maxDate),
        )
      )
      .orderBy(events.startDate);

    return NextResponse.json(allEvents);
  } catch (error) {
    return handleApiError(error, "events/available:GET");
  }
}
