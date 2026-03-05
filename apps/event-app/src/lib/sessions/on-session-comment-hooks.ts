import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessionComments, eventSessions, users } from "@/db/schema";
import { getModelMini } from "@/lib/ai/model";
import { broadcastToGroup } from "@/lib/pubsub";
import { createId } from "@/lib/utils";
import {
  webSearchTool,
  makePostMessageToGroupTool,
  makeCreateNetworkingGroupTool,
  ensureSiaUser,
} from "@/lib/networking/sia-agent";

const SIA_USER_ID = "sia-agent";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMessages(
  msgs: { userName: string | null; content: string; createdAt: Date }[]
): string {
  return msgs
    .map((m) => {
      const time = m.createdAt.toISOString().slice(11, 16);
      return `[${m.userName ?? "Unknown"}] (${time}) ${m.content}`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Tool: post_reply_to_session
// ---------------------------------------------------------------------------

function makePostReplyTool(sessionId: string) {
  return new DynamicStructuredTool({
    name: "post_reply_to_session",
    description:
      "Post a reply message to the current session chat as Sia.",
    schema: z.object({
      message: z
        .string()
        .describe("The message content to post (do NOT include a sender signature)"),
    }),
    func: async ({ message }) => {
      try {
        await ensureSiaUser();

        const commentId = createId();
        const [siaComment] = await db
          .insert(sessionComments)
          .values({
            id: commentId,
            sessionId,
            userId: SIA_USER_ID,
            content: message,
            isAiSummary: true,
          })
          .returning();

        await broadcastToGroup(`session:${sessionId}`, {
          type: "message:new",
          data: { ...siaComment, userName: "Sia" },
        });

        return "Message posted successfully.";
      } catch (error) {
        console.error("[sia-session] post_reply error:", error);
        return "Failed to post message. Please try again.";
      }
    },
  });
}

// ---------------------------------------------------------------------------
// runSiaSessionAgent
// ---------------------------------------------------------------------------

async function runSiaSessionAgent(
  sessionId: string,
  userId: string,
  userName: string
): Promise<void> {
  try {
    // Fetch session info for context (including eventId for group creation)
    const session = await db.query.eventSessions.findFirst({
      where: eq(eventSessions.id, sessionId),
      columns: { title: true, description: true, eventId: true },
    });

    // Fetch last 50 non-AI comments
    const allComments = await db
      .select({
        content: sessionComments.content,
        userName: users.name,
        createdAt: sessionComments.createdAt,
      })
      .from(sessionComments)
      .leftJoin(users, eq(sessionComments.userId, users.id))
      .where(
        and(
          eq(sessionComments.sessionId, sessionId),
          eq(sessionComments.isAiSummary, false)
        )
      )
      .orderBy(desc(sessionComments.createdAt))
      .limit(50);

    if (allComments.length === 0) return;

    const contextMessages = allComments.reverse();
    const recentMessages = contextMessages.slice(-5);

    const sessionContext = session
      ? `\nSESSION: "${session.title}"${session.description ? `\nDESCRIPTION: ${session.description}` : ""}`
      : "";

    const systemPrompt = `You are Sia, a friendly AI participant in a session discussion chat.
You sound like a knowledgeable colleague, not a bot.

RULES — YOU MUST FOLLOW THESE:
1. You can ONLY affect the real world through tool calls. If you did not call a tool, the action DID NOT happen.
2. NEVER claim you posted, sent, or created something unless the tool was called AND returned a success message in this turn.
3. When the user asks to create a networking group, you MUST call the create_networking_group tool. Do not just describe what a group could look like.
4. When the user asks to post a message to a group, you MUST call the post_message_to_group tool.
${sessionContext}

CONVERSATION CONTEXT (last ${contextMessages.length} messages):
${formatMessages(contextMessages)}

RECENT MESSAGES (last ${recentMessages.length}):
${formatMessages(recentMessages)}

TOOLS:
- post_reply_to_session(message) → post a reply in THIS session chat
- create_networking_group(name, description, openingMessage) → create a new networking group
- post_message_to_group(groupName, message) → post a message to an existing networking group
- web_search(query) → research a topic

INSTRUCTIONS:
- Focus primarily on the MOST RECENT message — that's who tagged you and what they want
- If asked to create a group, CALL create_networking_group — do not just talk about it
- If asked to post to a group, CALL post_message_to_group — do not just talk about it
- If it's a research question, use web_search then post_reply_to_session with the answer
- If it's just conversational, reply in 1-2 short sentences using post_reply_to_session
- Never start with "Great question!" or other generic filler
- Do not introduce yourself or explain that you are an AI
- Keep responses relevant to the session topic when possible`;

    const postTool = makePostReplyTool(sessionId);
    const postToGroupTool = makePostMessageToGroupTool(userName);
    const createGroupTool = makeCreateNetworkingGroupTool({
      invokingUserId: userId,
      eventId: session?.eventId ?? null,
    });

    const agent = createReactAgent({
      llm: getModelMini(),
      tools: [webSearchTool, postTool, postToGroupTool, createGroupTool],
      prompt: systemPrompt,
    });

    const result = await agent.invoke({
      messages: [
        {
          role: "user",
          content: "Respond to the recent messages based on your instructions.",
        },
      ],
    });

    // Check if agent already posted via tool — if not, post the final response
    const lastMessage = result.messages[result.messages.length - 1];
    const responseText =
      typeof lastMessage.content === "string" ? lastMessage.content : "";

    // If the agent used the post_reply tool, the message is already posted
    const usedPostTool = result.messages.some(
      (m: { type?: string; name?: string }) =>
        m.type === "tool" && m.name === "post_reply_to_session"
    );

    if (usedPostTool || !responseText.trim() || responseText.trim() === "__SKIP__") {
      return;
    }

    // Agent responded directly without using the tool — post it
    await ensureSiaUser();
    const commentId = createId();
    const [siaComment] = await db
      .insert(sessionComments)
      .values({
        id: commentId,
        sessionId,
        userId: SIA_USER_ID,
        content: responseText,
        isAiSummary: true,
      })
      .returning();

    await broadcastToGroup(`session:${sessionId}`, {
      type: "message:new",
      data: { ...siaComment, userName: "Sia" },
    });
  } catch (error) {
    console.error("[sia-session] runSiaSessionAgent error:", error);
  }
}

// ---------------------------------------------------------------------------
// onSessionCommentCreated — entry point from API route (fire-and-forget)
// ---------------------------------------------------------------------------

export function onSessionCommentCreated(
  sessionId: string,
  messageContent: string,
  userId: string,
  userName: string
): void {
  const hasSiaMention = /@sia\b/i.test(messageContent);

  if (hasSiaMention) {
    runSiaSessionAgent(sessionId, userId, userName).catch((err) =>
      console.error("[onSessionCommentCreated] sia error:", err)
    );
  }
}
