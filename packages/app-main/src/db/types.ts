/**
 * Drizzle ORM inferred types
 *
 * These types are automatically inferred from the schema definitions.
 */
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import * as schema from "./schema";

// ============================================
// AUTH TYPES
// ============================================

export type User = InferSelectModel<typeof schema.users>;
export type NewUser = InferInsertModel<typeof schema.users>;

export type Account = InferSelectModel<typeof schema.accounts>;
export type NewAccount = InferInsertModel<typeof schema.accounts>;

export type Session = InferSelectModel<typeof schema.sessions>;
export type NewSession = InferInsertModel<typeof schema.sessions>;

export type Verification = InferSelectModel<typeof schema.verifications>;
export type NewVerification = InferInsertModel<typeof schema.verifications>;

export type TwoFactor = InferSelectModel<typeof schema.twoFactors>;
export type NewTwoFactor = InferInsertModel<typeof schema.twoFactors>;

export type TwoFactorSettings = InferSelectModel<typeof schema.twoFactorSettings>;
export type NewTwoFactorSettings = InferInsertModel<typeof schema.twoFactorSettings>;

export type LoginHistory = InferSelectModel<typeof schema.loginHistory>;
export type NewLoginHistory = InferInsertModel<typeof schema.loginHistory>;

// ============================================
// GOAL TYPES
// ============================================

export type UserGoalSet = InferSelectModel<typeof schema.userGoalSets>;
export type NewUserGoalSet = InferInsertModel<typeof schema.userGoalSets>;

export type Goal = InferSelectModel<typeof schema.goals>;
export type NewGoal = InferInsertModel<typeof schema.goals>;

export type GoalProgressEstimate = InferSelectModel<typeof schema.goalProgressEstimates>;
export type NewGoalProgressEstimate = InferInsertModel<typeof schema.goalProgressEstimates>;

export type GoalUpdate = InferSelectModel<typeof schema.goalUpdates>;
export type NewGoalUpdate = InferInsertModel<typeof schema.goalUpdates>;

// ============================================
// EXPERT TYPES
// ============================================

export type ExpertReview = InferSelectModel<typeof schema.expertReviews>;
export type NewExpertReview = InferInsertModel<typeof schema.expertReviews>;

export type GoalExpertSelection = InferSelectModel<typeof schema.goalExpertSelections>;
export type NewGoalExpertSelection = InferInsertModel<typeof schema.goalExpertSelections>;

// ============================================
// TEAM TYPES
// ============================================

export type Team = InferSelectModel<typeof schema.teams>;
export type NewTeam = InferInsertModel<typeof schema.teams>;

export type TeamMember = InferSelectModel<typeof schema.teamMembers>;
export type NewTeamMember = InferInsertModel<typeof schema.teamMembers>;

export type TeamInvitation = InferSelectModel<typeof schema.teamInvitations>;
export type NewTeamInvitation = InferInsertModel<typeof schema.teamInvitations>;

// ============================================
// ACTIVITY TYPES
// ============================================

export type DailyUpdate = InferSelectModel<typeof schema.dailyUpdates>;
export type NewDailyUpdate = InferInsertModel<typeof schema.dailyUpdates>;

export type ExtractedActivity = InferSelectModel<typeof schema.extractedActivities>;
export type NewExtractedActivity = InferInsertModel<typeof schema.extractedActivities>;

// ============================================
// CHAT TYPES
// ============================================

export type ChatSession = InferSelectModel<typeof schema.chatSessions>;
export type NewChatSession = InferInsertModel<typeof schema.chatSessions>;

export type ChatMessage = InferSelectModel<typeof schema.chatMessages>;
export type NewChatMessage = InferInsertModel<typeof schema.chatMessages>;

export type UpdateFollowUp = InferSelectModel<typeof schema.updateFollowUps>;
export type NewUpdateFollowUp = InferInsertModel<typeof schema.updateFollowUps>;

// ============================================
// GAMIFICATION TYPES
// ============================================

export type Achievement = InferSelectModel<typeof schema.achievements>;
export type NewAchievement = InferInsertModel<typeof schema.achievements>;

export type UserAchievement = InferSelectModel<typeof schema.userAchievements>;
export type NewUserAchievement = InferInsertModel<typeof schema.userAchievements>;

// ============================================
// SETTINGS TYPES
// ============================================

export type NotificationSettings = InferSelectModel<typeof schema.notificationSettings>;
export type NewNotificationSettings = InferInsertModel<typeof schema.notificationSettings>;

export type AdminSettings = InferSelectModel<typeof schema.adminSettings>;
export type NewAdminSettings = InferInsertModel<typeof schema.adminSettings>;

// ============================================
// MISC TYPES
// ============================================

export type GoalGuide = InferSelectModel<typeof schema.goalGuides>;
export type NewGoalGuide = InferInsertModel<typeof schema.goalGuides>;

export type UserTodo = InferSelectModel<typeof schema.userTodos>;
export type NewUserTodo = InferInsertModel<typeof schema.userTodos>;

// ============================================
// EVENT TYPES
// ============================================

export type TeamEvent = InferSelectModel<typeof schema.teamEvents>;
export type NewTeamEvent = InferInsertModel<typeof schema.teamEvents>;

export type TeamEventAttendee = InferSelectModel<typeof schema.teamEventAttendees>;
export type NewTeamEventAttendee = InferInsertModel<typeof schema.teamEventAttendees>;

// ============================================
// AUDIT TYPES
// ============================================

export type AuditLog = InferSelectModel<typeof schema.auditLogs>;
export type NewAuditLog = InferInsertModel<typeof schema.auditLogs>;
