import type { CompiledStateGraph } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";

export async function agentStreamToResponse(
  agent: CompiledStateGraph<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    any, any, any, any, any, any
  >,
  input: { messages: BaseMessage[] },
): Promise<Response> {
  const encoder = new TextEncoder();

  const eventStream = agent.streamEvents(input, { version: "v2" });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of eventStream) {
          if (
            event.event === "on_chat_model_stream" &&
            event.metadata?.langgraph_node === "agent"
          ) {
            const content = event.data?.chunk?.content;
            if (typeof content === "string" && content) {
              controller.enqueue(encoder.encode(content));
            }
          }
        }
      } catch (error) {
        console.error("[agentStreamToResponse] Stream error:", error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
