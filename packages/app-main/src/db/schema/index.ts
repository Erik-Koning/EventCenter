/**
 * Drizzle Schema - Main export
 *
 * Re-exports all tables and relations for use with Drizzle ORM
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

// Goals tables
export { userGoalSets, goals, goalProgressEstimates, goalUpdates } from "./goals";

// Experts tables
export { expertReviews, goalExpertSelections } from "./experts";

// Teams tables
export { teams, teamMembers, teamInvitations } from "./teams";

// Activities tables
export { dailyUpdates, extractedActivities } from "./activities";

// Chat tables
export { chatSessions, chatMessages, updateFollowUps } from "./chat";

// Gamification tables
export { achievements, userAchievements } from "./gamification";

// Settings tables
export { notificationSettings, adminSettings } from "./settings";

// Misc tables
export { goalGuides, userTodos } from "./misc";

// Events tables
export { teamEvents, teamEventAttendees } from "./events";

// Audit tables
export { auditLogs } from "./audit";

// All relations
export * from "./relations";
