/**
 * Drizzle Schema - Auth + Networking export for event-app
 */

// Auth tables
export {
  users,
  accounts,
  sessions,
  verifications,
  twoFactors,
  twoFactorSettings,
  loginHistory,
} from "./auth";

// Networking tables
export {
  networkingGroups,
  networkingGroupMembers,
  networkingMessages,
  networkingMindMapNodes,
} from "./networking";

// Sessions
export {
  trackEnum,
  eventSessions,
  sessionSpeakers,
  sessionUpvotes,
  sessionComments,
} from "./sessions";

// Events
export { events, eventAttendees } from "./events";

// All relations
export * from "./relations";
