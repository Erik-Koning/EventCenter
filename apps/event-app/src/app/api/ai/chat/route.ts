import { requireAuth } from "@/lib/authorization";
import { handleApiError, commonErrors } from "@/lib/api-error";
import { getEventContext } from "@/lib/chat/event-context-cache";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { attendees } from "@/db/schema";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { createEventAgent } from "@/lib/ai/agent";
import { agentStreamToResponse } from "@/lib/ai/stream";

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

    // Resolve event from attendee enrollment
    const attendee = await db.query.attendees.findFirst({
      where: eq(attendees.userId, user.id),
      with: { eventAttendees: { limit: 1 } },
    });

    const eventId = attendee?.eventAttendees?.[0]?.eventId;
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
