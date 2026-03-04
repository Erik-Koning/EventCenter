import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { networkingGroups, networkingMessages } from "@/db/schema";
import { getAzureOpenAIClient, getDeploymentName } from "@/lib/azure-openai";
import { broadcastToGroup } from "@/lib/pubsub";

const SYSTEM_PROMPT = `You analyze group chat conversations. Return a JSON array of 8-12 short insight strings.
Categories: hot topics, open questions, things to research, emerging trends.
Merge with and update the previous insights — drop stale ones, keep relevant ones, add new ones.
Return ONLY a valid JSON array of strings, no other text.`;

export async function generateInsights(groupId: string): Promise<void> {
  try {
    // Fetch last 30 non-AI messages
    const recentMessages = await db
      .select({ content: networkingMessages.content })
      .from(networkingMessages)
      .where(
        and(
          eq(networkingMessages.groupId, groupId),
          eq(networkingMessages.isAiSummary, false)
        )
      )
      .orderBy(desc(networkingMessages.createdAt))
      .limit(30);

    if (recentMessages.length === 0) return;

    // Fetch current insights
    const [group] = await db
      .select({ insights: networkingGroups.insights })
      .from(networkingGroups)
      .where(eq(networkingGroups.id, groupId))
      .limit(1);

    if (!group) return;

    const previousInsights = group.insights ?? [];
    const messageContents = recentMessages
      .map((m) => m.content)
      .reverse()
      .join("\n");

    const userMessage = `Previous insights:\n${JSON.stringify(previousInsights)}\n\nRecent messages:\n${messageContents}`;

    const client = getAzureOpenAIClient();
    const response = await client.chat.completions.create({
      model: getDeploymentName(),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return;

    const insights: string[] = JSON.parse(raw);
    if (!Array.isArray(insights)) return;

    // Update DB
    await db
      .update(networkingGroups)
      .set({ insights })
      .where(eq(networkingGroups.id, groupId));

    // Broadcast to group
    await broadcastToGroup(groupId, {
      type: "insights:updated",
      data: { insights },
    });
  } catch (error) {
    console.error("[generateInsights] Error:", error);
  }
}
