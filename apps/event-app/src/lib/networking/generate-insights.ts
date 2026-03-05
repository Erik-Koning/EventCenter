import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { networkingGroups, networkingMessages } from "@/db/schema";
import { getAzureOpenAIClient, getDeploymentNameMini } from "@/lib/azure-openai";
import { broadcastToGroup } from "@/lib/pubsub";

interface Insight {
  title: string;
  description: string;
}

const SYSTEM_PROMPT = `You analyze group chat conversations. Return a JSON array of 8-12 insight objects.
Each insight must have:
- "title": 1-3 words (a concise label)
- "description": 1-2 sentences (a brief explanation)

Categories: hot topics, open questions, things to research, emerging trends.
Merge with and update the previous insights — drop stale ones, keep relevant ones, add new ones.
Return ONLY a valid JSON array of objects, no other text.

Example:
[{"title":"AI Governance","description":"Multiple participants raised questions about responsible AI frameworks and who should own governance policies."}]`;

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
      model: getDeploymentNameMini(),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 1024,
      response_format: { type: "json_object" },
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return;

    const parsed = JSON.parse(raw);
    // Handle both { insights: [...] } and direct array
    const insights: Insight[] = Array.isArray(parsed) ? parsed : parsed.insights;
    if (!Array.isArray(insights)) return;

    // Validate structure
    const valid = insights.filter(
      (i) => typeof i.title === "string" && typeof i.description === "string"
    );
    if (valid.length === 0) return;

    // Update DB
    await db
      .update(networkingGroups)
      .set({ insights: valid })
      .where(eq(networkingGroups.id, groupId));

    // Broadcast to group
    await broadcastToGroup(groupId, {
      type: "insights:updated",
      data: { insights: valid },
    });
  } catch (error) {
    console.error("[generateInsights] Error:", error);
  }
}
