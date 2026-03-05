import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { db } from "@/lib/db";
import { events } from "@/db/schema";
import { generateDayRecap } from "@/lib/recap/generate-recap";
import type { DayRecapData } from "@/data/recap-types";

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

// ─── GET — poll recap status ──────────────────────────────────

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const authResult = await requireAuth();
    if (!authResult.success) return authResult.response;

    const { eventId } = await params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return commonErrors.badRequest("Missing 'date' query parameter");
    }

    const [event] = await db
      .select({ recaps: events.recaps })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) return commonErrors.notFound("Event");

    const recaps = (event.recaps ?? {}) as Record<string, "loading" | DayRecapData>;
    const value = recaps[date];

    if (!value) {
      return NextResponse.json({ status: "not_started" });
    }

    if (value === "loading") {
      return NextResponse.json({ status: "loading" });
    }

    return NextResponse.json({ status: "ready", recap: value });
  } catch (error) {
    return handleApiError(error, "get-recap");
  }
}

// ─── POST — trigger generation ────────────────────────────────

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const authResult = await requireAuth();
    if (!authResult.success) return authResult.response;

    const { eventId } = await params;
    const body = await request.json();
    const date = body.date as string;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return commonErrors.badRequest("Invalid or missing 'date' (YYYY-MM-DD)");
    }

    // Fetch event
    const [event] = await db
      .select({
        id: events.id,
        startDate: events.startDate,
        endDate: events.endDate,
        recaps: events.recaps,
      })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) return commonErrors.notFound("Event");

    // Validate date is within event range
    if (date < event.startDate || date > event.endDate) {
      return commonErrors.badRequest("Date is outside event range");
    }

    // Check if recap already exists
    const recaps = (event.recaps ?? {}) as Record<string, "loading" | DayRecapData>;
    const existing = recaps[date];
    if (existing === "loading") {
      return NextResponse.json({ status: "generating" }, { status: 202 });
    }
    if (existing) {
      return NextResponse.json({ status: "ready", recap: existing });
    }

    // Set loading state
    await db
      .update(events)
      .set({
        recaps: sql`jsonb_set(COALESCE(${events.recaps}, '{}'::jsonb), ${sql.raw(`'{${date}}'`)}, '"loading"'::jsonb)`,
      })
      .where(eq(events.id, eventId));

    // Fire-and-forget generation
    generateDayRecap(eventId, date).catch((err) => {
      console.error(`[recap] Background generation failed for ${eventId}/${date}:`, err);
    });

    return NextResponse.json({ status: "generating" }, { status: 202 });
  } catch (error) {
    return handleApiError(error, "trigger-recap");
  }
}
