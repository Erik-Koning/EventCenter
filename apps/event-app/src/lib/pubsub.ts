import { WebPubSubServiceClient } from "@azure/web-pubsub";

const HUB_NAME = "networking";

let client: WebPubSubServiceClient | null = null;

function getClient(): WebPubSubServiceClient | null {
  if (client) return client;
  const connStr = process.env.AZURE_WEB_PUBSUB_CONNECTION_STRING;
  if (!connStr) {
    console.warn("[pubsub] AZURE_WEB_PUBSUB_CONNECTION_STRING is not set");
    return null;
  }
  try {
    client = new WebPubSubServiceClient(connStr, HUB_NAME);
    return client;
  } catch (error) {
    console.warn("[pubsub] Invalid connection string:", error);
    return null;
  }
}

export async function broadcastToGroup(
  groupId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    await c.group(groupId).sendToAll(payload);
  } catch (error) {
    console.error("[pubsub] broadcast error:", error);
  }
}

export async function generateClientUrl(
  userId: string,
  groupIds: string[]
): Promise<string | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const { url } = await c.getClientAccessToken({
      userId,
      groups: groupIds,
    });
    return url;
  } catch (error) {
    console.error("[pubsub] generateClientUrl error:", error);
    return null;
  }
}
