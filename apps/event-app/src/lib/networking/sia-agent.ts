import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { eq, and, asc, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { networkingMessages, users } from "@/db/schema";
import { getModelMini } from "@/lib/ai/model";
import { broadcastToGroup } from "@/lib/pubsub";
import { createId } from "@/lib/utils";
import Exa from "exa-js";

const SIA_USER_ID = "sia-agent";

function getExaClient(): Exa {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) throw new Error("EXA_API_KEY is required for Sia web search");
  return new Exa(apiKey);
}

const webSearchTool = new DynamicStructuredTool({
  name: "web_search",
  description:
    "Search the web for information on a topic. Use this to research questions, verify facts, or find relevant articles.",
  schema: z.object({
    query: z.string().describe("The search query"),
  }),
  func: async ({ query }) => {
    try {
      const exa = getExaClient();
      const results = await exa.searchAndContents(query, {
        numResults: 5,
        text: { maxCharacters: 500 },
      });
      if (!results.results?.length) return "No results found.";
      return results.results
        .map(
          (r: { title?: string; url: string; text?: string }) =>
            `${r.title ?? "Untitled"} — ${r.url}\n${r.text ?? ""}\n---`
        )
        .join("\n");
    } catch (error) {
      console.error("[sia] web_search error:", error);
      return "Search failed. Respond based on your existing knowledge.";
    }
  },
});

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

function buildSystemPrompt(
  contextMessages: { userName: string | null; content: string; createdAt: Date }[],
  recentMessages: { userName: string | null; content: string; createdAt: Date }[]
): string {
  return `You are Sia, an AI research assistant in a group networking chat.
You observe conversations and help when useful.

CONVERSATION CONTEXT (last ${contextMessages.length} messages):
${formatMessages(contextMessages)}

RECENT MESSAGES TO ADDRESS (last ${recentMessages.length}):
${formatMessages(recentMessages)}

INSTRUCTIONS:
- Respond to ALL messages that mention @sia — these are direct requests to you
- If no @sia mentions, you MAY respond to ONE message if:
  - Someone asked an interesting question worth researching
  - There's a factual claim you can verify or expand on
  - An idea could benefit from quick web research
- If nothing warrants a response, reply with exactly: __SKIP__
- Use the web_search tool to research topics before responding
- Keep responses concise and chat-friendly (1-3 short paragraphs)
- Always cite sources with URLs when using web_search results
- Be helpful but not intrusive — quality over quantity`;
}

export async function runSiaAgent(groupId: string): Promise<void> {
  try {
    // Fetch last 50 non-AI messages with user names
    const allMessages = await db
      .select({
        content: networkingMessages.content,
        userName: users.name,
        createdAt: networkingMessages.createdAt,
      })
      .from(networkingMessages)
      .leftJoin(users, eq(networkingMessages.userId, users.id))
      .where(
        and(
          eq(networkingMessages.groupId, groupId),
          eq(networkingMessages.isAiSummary, false)
        )
      )
      .orderBy(desc(networkingMessages.createdAt))
      .limit(50);

    if (allMessages.length === 0) return;

    // Reverse to chronological order
    const contextMessages = allMessages.reverse();
    const recentMessages = contextMessages.slice(-5);

    const systemPrompt = buildSystemPrompt(contextMessages, recentMessages);

    const agent = createReactAgent({
      llm: getModelMini(),
      tools: [webSearchTool],
      prompt: systemPrompt,
    });

    const result = await agent.invoke({
      messages: [{ role: "user", content: "Respond to the recent messages based on your instructions." }],
    });

    // Extract final AI response
    const lastMessage = result.messages[result.messages.length - 1];
    const responseText =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : "";

    // Skip if empty or explicit skip
    if (!responseText.trim() || responseText.trim() === "__SKIP__") return;

    // Insert Sia's message
    const messageId = createId();
    const [siaMessage] = await db
      .insert(networkingMessages)
      .values({
        id: messageId,
        groupId,
        userId: SIA_USER_ID,
        content: responseText,
        isAiSummary: true,
      })
      .returning();

    // Broadcast to group
    await broadcastToGroup(groupId, {
      type: "message:new",
      data: { ...siaMessage, userName: "Sia" },
    });
  } catch (error) {
    console.error("[sia] runSiaAgent error:", error);
  }
}
