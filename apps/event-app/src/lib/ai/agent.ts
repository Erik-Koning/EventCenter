import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { getModelMini } from "./model";
import { createEventTools } from "./tools";
import { buildSystemPrompt } from "./prompts";
import type { EventContext } from "@/lib/chat/event-context-cache";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Agent = ReturnType<typeof createReactAgent> extends infer R ? R : any;

export function createEventAgent(
  eventId: string,
  context: EventContext,
  userName?: string | null,
): Agent {
  // Type assertion needed: createReactAgent has excessively deep generic inference
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (createReactAgent as any)({
    llm: getModelMini(),
    tools: createEventTools(eventId),
    messageModifier: buildSystemPrompt(context, userName),
  });
}
