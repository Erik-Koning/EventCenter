import { runSiaAgent } from "./sia-agent";
import { generateInsights } from "./generate-insights";

export function onMessageCreated(
  groupId: string,
  messageContent: string,
  nonAiCount: number
): void {
  const hasSiaMention = /@sia\b/i.test(messageContent);
  const isFifthMessage = nonAiCount % 5 === 0;

  if (hasSiaMention || isFifthMessage) {
    runSiaAgent(groupId).catch((err) =>
      console.error("[onMessageCreated] sia error:", err)
    );
  }

  if (isFifthMessage) {
    generateInsights(groupId).catch((err) =>
      console.error("[onMessageCreated] insights error:", err)
    );
  }
}
