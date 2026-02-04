/**
 * Drizzle ORM Relations
 *
 * Defines all relationships between tables for use with db.query API
 */
import { relations } from "drizzle-orm";

// Import all tables
import {
  users,
  accounts,
  sessions,
  verifications,
  twoFactors,
  twoFactorSettings,
  loginHistory,
} from "./auth";
import { userGoalSets, goals, goalProgressEstimates, goalUpdates } from "./goals";
import { expertReviews, goalExpertSelections } from "./experts";
import { teams, teamMembers, teamInvitations } from "./teams";
import { dailyUpdates, extractedActivities } from "./activities";
import { chatSessions, chatMessages, updateFollowUps } from "./chat";
import { teamEvents, teamEventAttendees } from "./events";
import { achievements, userAchievements } from "./gamification";
import { notificationSettings, adminSettings } from "./settings";
import { goalGuides, userTodos } from "./misc";
import { auditLogs } from "./audit";

// ============================================
// USER RELATIONS
// ============================================

export const usersRelations = relations(users, ({ one, many }) => ({
  // Better Auth relations
  accounts: many(accounts),
  sessions: many(sessions),

  // 2FA relations
  twoFactor: one(twoFactors, {
    fields: [users.id],
    references: [twoFactors.userId],
  }),
  twoFactorSettings: one(twoFactorSettings, {
    fields: [users.id],
    references: [twoFactorSettings.userId],
  }),

  // Goal relations
  goalSets: many(userGoalSets, { relationName: "GoalSetOwner" }),
  approvedGoalSets: many(userGoalSets, { relationName: "GoalSetApprover" }),
  goals: many(goals, { relationName: "UserGoals" }),
  goalUpdates: many(goalUpdates),
  modifiedEstimates: many(goalProgressEstimates, { relationName: "EstimateModifier" }),

  // Guide relations
  createdGuides: many(goalGuides, { relationName: "GuideCreator" }),
  assignedGuides: many(goalGuides, { relationName: "GuideAssignee" }),

  // Activity relations
  dailyUpdates: many(dailyUpdates),
  extractedActivities: many(extractedActivities),

  // Chat relations
  chatSessions: many(chatSessions),
  updateFollowUps: many(updateFollowUps),

  // Team relations
  createdTeams: many(teams, { relationName: "TeamCreator" }),
  teamMemberships: many(teamMembers),
  sentInvitations: many(teamInvitations, { relationName: "InvitationSender" }),
  activeTeam: one(teams, {
    fields: [users.activeTeamId],
    references: [teams.id],
    relationName: "UserActiveTeam",
  }),

  // Gamification relations
  userAchievements: many(userAchievements),

  // Settings relations
  notificationSettings: one(notificationSettings, {
    fields: [users.id],
    references: [notificationSettings.userId],
  }),
  adminSettings: many(adminSettings),

  // Todo relations
  todos: many(userTodos),

  // Login history
  loginHistory: many(loginHistory),

  // Event relations
  createdEvents: many(teamEvents, { relationName: "EventCreator" }),
  eventAttendances: many(teamEventAttendees),

  // Audit logs
  auditLogs: many(auditLogs),
}));

// ============================================
// BETTER AUTH RELATIONS
// ============================================

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// ============================================
// 2FA RELATIONS
// ============================================

export const twoFactorsRelations = relations(twoFactors, ({ one }) => ({
  user: one(users, {
    fields: [twoFactors.userId],
    references: [users.id],
  }),
}));

export const twoFactorSettingsRelations = relations(twoFactorSettings, ({ one }) => ({
  user: one(users, {
    fields: [twoFactorSettings.userId],
    references: [users.id],
  }),
}));

export const loginHistoryRelations = relations(loginHistory, ({ one }) => ({
  user: one(users, {
    fields: [loginHistory.userId],
    references: [users.id],
  }),
}));

// ============================================
// GOAL RELATIONS
// ============================================

export const userGoalSetsRelations = relations(userGoalSets, ({ one, many }) => ({
  user: one(users, {
    fields: [userGoalSets.userId],
    references: [users.id],
    relationName: "GoalSetOwner",
  }),
  approvedBy: one(users, {
    fields: [userGoalSets.approvedById],
    references: [users.id],
    relationName: "GoalSetApprover",
  }),
  goals: many(goals),
  dailyUpdates: many(dailyUpdates),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
    relationName: "UserGoals",
  }),
  userGoalSet: one(userGoalSets, {
    fields: [goals.userGoalSetId],
    references: [userGoalSets.id],
  }),
  progressEstimates: many(goalProgressEstimates),
  expertReviews: many(expertReviews),
  expertSelections: many(goalExpertSelections),
  linkedActivities: many(extractedActivities),
  goalUpdates: many(goalUpdates),
}));

export const goalProgressEstimatesRelations = relations(goalProgressEstimates, ({ one }) => ({
  goal: one(goals, {
    fields: [goalProgressEstimates.goalId],
    references: [goals.id],
  }),
  modifiedBy: one(users, {
    fields: [goalProgressEstimates.modifiedById],
    references: [users.id],
    relationName: "EstimateModifier",
  }),
}));

export const goalUpdatesRelations = relations(goalUpdates, ({ one }) => ({
  goal: one(goals, {
    fields: [goalUpdates.goalId],
    references: [goals.id],
  }),
  user: one(users, {
    fields: [goalUpdates.userId],
    references: [users.id],
  }),
}));

// ============================================
// EXPERT RELATIONS
// ============================================

export const expertReviewsRelations = relations(expertReviews, ({ one }) => ({
  goal: one(goals, {
    fields: [expertReviews.goalId],
    references: [goals.id],
  }),
}));

export const goalExpertSelectionsRelations = relations(goalExpertSelections, ({ one }) => ({
  goal: one(goals, {
    fields: [goalExpertSelections.goalId],
    references: [goals.id],
  }),
}));

// ============================================
// TEAM RELATIONS
// ============================================

export const teamsRelations = relations(teams, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [teams.createdById],
    references: [users.id],
    relationName: "TeamCreator",
  }),
  members: many(teamMembers),
  invitations: many(teamInvitations),
  usersWithActiveTeam: many(users, { relationName: "UserActiveTeam" }),
  dailyUpdates: many(dailyUpdates),
  chatSessions: many(chatSessions),
  extractedActivities: many(extractedActivities),
  followUps: many(updateFollowUps),
  events: many(teamEvents),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [teamInvitations.invitedById],
    references: [users.id],
    relationName: "InvitationSender",
  }),
}));

// ============================================
// ACTIVITY RELATIONS
// ============================================

export const dailyUpdatesRelations = relations(dailyUpdates, ({ one, many }) => ({
  user: one(users, {
    fields: [dailyUpdates.userId],
    references: [users.id],
  }),
  userGoalSet: one(userGoalSets, {
    fields: [dailyUpdates.userGoalSetId],
    references: [userGoalSets.id],
  }),
  team: one(teams, {
    fields: [dailyUpdates.teamId],
    references: [teams.id],
  }),
  extractedActivities: many(extractedActivities),
  chatSession: one(chatSessions, {
    fields: [dailyUpdates.id],
    references: [chatSessions.dailyUpdateId],
  }),
}));

export const extractedActivitiesRelations = relations(extractedActivities, ({ one, many }) => ({
  dailyUpdate: one(dailyUpdates, {
    fields: [extractedActivities.dailyUpdateId],
    references: [dailyUpdates.id],
  }),
  user: one(users, {
    fields: [extractedActivities.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [extractedActivities.teamId],
    references: [teams.id],
  }),
  linkedGoal: one(goals, {
    fields: [extractedActivities.linkedGoalId],
    references: [goals.id],
  }),
  followUps: many(updateFollowUps),
}));

// ============================================
// CHAT RELATIONS
// ============================================

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [chatSessions.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [chatSessions.teamId],
    references: [teams.id],
  }),
  messages: many(chatMessages),
  dailyUpdate: one(dailyUpdates, {
    fields: [chatSessions.dailyUpdateId],
    references: [dailyUpdates.id],
  }),
  followUps: many(updateFollowUps),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  chatSession: one(chatSessions, {
    fields: [chatMessages.chatSessionId],
    references: [chatSessions.id],
  }),
}));

export const updateFollowUpsRelations = relations(updateFollowUps, ({ one }) => ({
  chatSession: one(chatSessions, {
    fields: [updateFollowUps.chatSessionId],
    references: [chatSessions.id],
  }),
  extractedActivity: one(extractedActivities, {
    fields: [updateFollowUps.extractedActivityId],
    references: [extractedActivities.id],
  }),
  user: one(users, {
    fields: [updateFollowUps.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [updateFollowUps.teamId],
    references: [teams.id],
  }),
  linkedEvent: one(teamEvents, {
    fields: [updateFollowUps.linkedEventId],
    references: [teamEvents.id],
  }),
}));

// ============================================
// GAMIFICATION RELATIONS
// ============================================

export const achievementsRelations = relations(achievements, ({ many }) => ({
  userAchievements: many(userAchievements),
}));

export const userAchievementsRelations = relations(userAchievements, ({ one }) => ({
  user: one(users, {
    fields: [userAchievements.userId],
    references: [users.id],
  }),
  achievement: one(achievements, {
    fields: [userAchievements.achievementId],
    references: [achievements.id],
  }),
}));

// ============================================
// SETTINGS RELATIONS
// ============================================

export const notificationSettingsRelations = relations(notificationSettings, ({ one }) => ({
  user: one(users, {
    fields: [notificationSettings.userId],
    references: [users.id],
  }),
}));

export const adminSettingsRelations = relations(adminSettings, ({ one }) => ({
  admin: one(users, {
    fields: [adminSettings.adminId],
    references: [users.id],
  }),
}));

// ============================================
// MISC RELATIONS
// ============================================

export const goalGuidesRelations = relations(goalGuides, ({ one }) => ({
  createdBy: one(users, {
    fields: [goalGuides.createdById],
    references: [users.id],
    relationName: "GuideCreator",
  }),
  appliesTo: one(users, {
    fields: [goalGuides.appliesToUserId],
    references: [users.id],
    relationName: "GuideAssignee",
  }),
}));

export const userTodosRelations = relations(userTodos, ({ one }) => ({
  user: one(users, {
    fields: [userTodos.userId],
    references: [users.id],
  }),
}));

// ============================================
// EVENT RELATIONS
// ============================================

export const teamEventsRelations = relations(teamEvents, ({ one, many }) => ({
  team: one(teams, {
    fields: [teamEvents.teamId],
    references: [teams.id],
  }),
  createdBy: one(users, {
    fields: [teamEvents.createdById],
    references: [users.id],
    relationName: "EventCreator",
  }),
  attendees: many(teamEventAttendees),
}));

export const teamEventAttendeesRelations = relations(teamEventAttendees, ({ one }) => ({
  event: one(teamEvents, {
    fields: [teamEventAttendees.eventId],
    references: [teamEvents.id],
  }),
  user: one(users, {
    fields: [teamEventAttendees.userId],
    references: [users.id],
  }),
}));

// ============================================
// AUDIT LOG RELATIONS
// ============================================

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));
