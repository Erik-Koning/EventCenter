import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { EmailClient } from "@azure/communication-email";
import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { getRequiredEnv } from "@/lib/environment";
import { db } from "@/lib/db";
import { events, users } from "@/db/schema";
import type { DayRecapData } from "@/data/recap-types";

const sendEmailSchema = z.object({
  eventId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recipientIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth({ permissions: { role: "admin" } });
    if (!authResult.success) return authResult.response;

    const body = await request.json();
    const { eventId, date, recipientIds } = sendEmailSchema.parse(body);

    // Fetch recap data
    const [event] = await db
      .select({ recaps: events.recaps, title: events.title })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1);

    if (!event) return commonErrors.notFound("Event");

    const recaps = (event.recaps ?? {}) as Record<string, "loading" | DayRecapData>;
    const recap = recaps[date];

    if (!recap || recap === "loading") {
      return commonErrors.badRequest("Recap not ready for this date");
    }

    // Fetch recipient emails
    const recipients = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(inArray(users.id, recipientIds));

    const withEmail = recipients.filter((r) => r.email);
    if (withEmail.length === 0) {
      return commonErrors.badRequest("No recipients have email addresses");
    }

    // Build email HTML
    const html = buildRecapEmailHtml(recap, event.title);

    // Send emails
    const emailClient = new EmailClient(getRequiredEnv("AZURE_CONNECTION_STRING"));
    const senderAddress = getRequiredEnv("AZURE_SENDER_EMAIL");
    let sent = 0;

    for (const recipient of withEmail) {
      try {
        const poller = await emailClient.beginSend({
          senderAddress,
          content: {
            subject: `${recap.conference} — Day ${recap.day} Recap`,
            html,
            plainText: `${recap.conference} Day ${recap.day} Recap — ${recap.tagline}`,
          },
          recipients: {
            to: [{ address: recipient.email!, displayName: recipient.name }],
          },
        });
        await poller.pollUntilDone();
        sent++;
      } catch (err) {
        console.error(`[send-recap-email] Failed for ${recipient.email}:`, err);
      }
    }

    return NextResponse.json({ success: true, sent });
  } catch (error) {
    return handleApiError(error, "admin/reports/send-email");
  }
}

function buildRecapEmailHtml(recap: DayRecapData, eventTitle: string): string {
  const statsHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <tr>
        ${statCell("Attendees", recap.stats.attendees)}
        ${statCell("Messages", recap.stats.messages)}
        ${statCell("Connections", recap.stats.connections)}
        ${statCell("Sessions", recap.stats.sessions)}
        ${statCell("Rooms", recap.stats.breakoutRooms)}
        ${statCell("@sia", recap.stats.siaCommands)}
      </tr>
    </table>`;

  const headlinesHtml = recap.headlines.length > 0
    ? `<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#666;border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:24px;">Headlines</h2>
       ${recap.headlines.map((h) => `
         <div style="margin:12px 0;padding:12px;border:1px solid #e5e5e5;border-radius:8px;">
           <strong style="font-size:14px;">${h.headline}</strong>${h.hot ? ' <span style="color:#f97316;">&#128293;</span>' : ""}
           <p style="margin:6px 0 0;font-size:13px;color:#555;">${h.summary}</p>
           <p style="margin:4px 0 0;font-size:11px;color:#999;">${h.room}${h.messages > 0 ? ` &middot; ${h.messages} messages` : ""}</p>
         </div>`).join("")}`
    : "";

  const quotesHtml = recap.topQuotes.length > 0
    ? `<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#666;border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:24px;">Quoteboard</h2>
       ${recap.topQuotes.map((q) => `
         <blockquote style="margin:12px 0;padding:10px 14px;border-left:3px solid #6366f1;background:#f9fafb;border-radius:4px;">
           <p style="margin:0;font-style:italic;font-size:13px;">&ldquo;${q.text}&rdquo;</p>
           <p style="margin:4px 0 0;font-size:11px;color:#888;">&mdash; ${q.author}</p>
         </blockquote>`).join("")}`
    : "";

  const awardsHtml = recap.awards.length > 0
    ? `<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:2px;color:#666;border-bottom:1px solid #ddd;padding-bottom:6px;margin-top:24px;">Day ${recap.day} Awards</h2>
       ${recap.awards.map((a) => `
         <div style="margin:8px 0;padding:10px;border:1px solid #e5e5e5;border-radius:8px;">
           <span style="font-size:18px;">${a.emoji}</span>
           <strong style="font-size:13px;margin-left:8px;">${a.title}</strong>
           <p style="margin:4px 0 0;font-size:12px;color:#666;">${a.detail}</p>
         </div>`).join("")}`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#faf8f4;border:1px solid #e5e5e5;border-radius:12px;overflow:hidden;">
      <!-- Masthead -->
      <div style="text-align:center;padding:24px 20px 16px;border-bottom:2px solid #333;">
        <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#888;">${recap.date}</p>
        <h1 style="margin:4px 0;font-size:26px;font-weight:900;text-transform:uppercase;letter-spacing:1px;">The ${recap.conference} Times</h1>
        <p style="margin:0;font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#888;">Day ${recap.day} Edition</p>
        <p style="margin:12px 0 0;font-style:italic;font-size:15px;color:#444;">&ldquo;${recap.tagline}&rdquo;</p>
      </div>

      <!-- Stats -->
      ${statsHtml}

      <!-- Content -->
      <div style="padding:0 20px 20px;">
        ${headlinesHtml}
        ${quotesHtml}
        ${awardsHtml}
      </div>

      <!-- Footer -->
      <div style="text-align:center;padding:12px;border-top:1px solid #e5e5e5;">
        <p style="margin:0;font-size:9px;color:#999;letter-spacing:1px;">AI-GENERATED RECAP &bull; ${eventTitle}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function statCell(label: string, value: number): string {
  return `<td style="text-align:center;padding:12px 4px;background:#faf8f4;">
    <div style="font-size:16px;font-weight:700;">${value}</div>
    <div style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#888;">${label}</div>
  </td>`;
}
