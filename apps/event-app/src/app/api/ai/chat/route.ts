import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { getEventContext } from "@/lib/chat/event-context-cache";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { eventAttendees } from "@/db/schema";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createEventAgent } from "@/lib/ai/agent";
import { agentStreamToResponse } from "@/lib/ai/stream";
import { runSiaCommand } from "@/lib/networking/sia-agent";

export async function POST(request: Request) {
  try {
    const authResult = await requireAuth({ rateLimit: "standard_llm" });
    if (!authResult.success) return authResult.response;
    const { user } = authResult;

    const body = await request.json();
    const { message, history } = body as {
      message: string;
      history?: { role: "user" | "assistant"; content: string }[];
    };

    if (!message || typeof message !== "string") {
      return commonErrors.badRequest("Message is required");
    }

    // Resolve event from enrollment
    const enrollment = await db.query.eventAttendees.findFirst({
      where: eq(eventAttendees.userId, user.id),
    });

    const eventId = enrollment?.eventId;

    // Route @sia commands (and follow-ups in a @sia conversation) to the Sia agent
    const hasSiaMention = /@sia\b/i.test(message);
    const recentSiaConversation = !hasSiaMention && history?.some((m) => /@sia\b/i.test(m.content));
    if (hasSiaMention || recentSiaConversation) {
      const siaHistory = (history ?? []).slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      const result = await runSiaCommand(message, user.id, user.name, eventId ?? null, siaHistory);
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(result.content));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
        },
      });
    }
    if (!eventId) {
      return commonErrors.notFound("Event enrollment");
    }

    const context = await getEventContext(eventId);
    if (!context) {
      return commonErrors.notFound("Event");
    }

    // Build LangGraph message history
    const messages = [];

    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-20)) {
        if (msg.role === "user") {
          messages.push(new HumanMessage(msg.content));
        } else {
          messages.push(new AIMessage(msg.content));
        }
      }
    }

    messages.push(new HumanMessage(message));

    const agent = createEventAgent(eventId, context, user.name);

    return await agentStreamToResponse(agent, { messages });
  } catch (error) {
    return handleApiError(error, "ai-chat");
  }
}
