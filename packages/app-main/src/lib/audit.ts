import { db } from "./db";
import { auditLogs } from "@/db/schema";
import { createId } from "./utils";

/**
 * Record an action in the audit log.
 * Fire-and-forget — does not throw on failure.
 */
export async function logAuditEvent(params: {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      id: createId(),
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
    });
  } catch (error) {
    console.error("[audit] Failed to write audit log:", error);
  }
}
