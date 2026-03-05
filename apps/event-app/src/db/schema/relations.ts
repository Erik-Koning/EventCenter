/**
 * Drizzle ORM Relations — Auth + Networking + Event for event-app
 */
import { relations } from "drizzle-orm";

import {
  users,
  accounts,
  sessions,
  twoFactors,
  twoFactorSettings,
  loginHistory,
} from "./auth";

import {
  networkingGroups,
  networkingGroupMembers,
  networkingMessages,
  networkingMindMapNodes,
} from "./networking";

import {
  eventSessions,
  sessionSpeakers,
  sessionUpvotes,
  sessionComments,
} from "./sessions";

import {
  events,
  eventAttendees,
} from "./events";


// ============================================
// USER RELATIONS
// ============================================

export const usersRelations = relations(users, ({ one, many }) => ({
  // Better Auth relations
  accounts: many(accounts),
  sessions: many(sessions),

  // Current event
  currentEvent: one(events, {
    fields: [users.currentEventId],
    references: [events.id],
  }),

  // 2FA relations
  twoFactor: one(twoFactors, {
    fields: [users.id],
    references: [twoFactors.userId],
  }),
  twoFactorSettings: one(twoFactorSettings, {
    fields: [users.id],
    references: [twoFactorSettings.userId],
  }),

  // Login history
  loginHistory: many(loginHistory),

  // Networking
  createdNetworkingGroups: many(networkingGroups),
  networkingMemberships: many(networkingGroupMembers),
  networkingMessages: many(networkingMessages),
  networkingMindMapNodes: many(networkingMindMapNodes),

  // Event
  eventAttendees: many(eventAttendees),
  sessionSpeakers: many(sessionSpeakers),
  sessionUpvotes: many(sessionUpvotes),
  sessionComments: many(sessionComments),
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
// NETWORKING RELATIONS
// ============================================

export const networkingGroupsRelations = relations(networkingGroups, ({ one, many }) => ({
  creator: one(users, {
    fields: [networkingGroups.creatorId],
    references: [users.id],
  }),
  event: one(events, {
    fields: [networkingGroups.eventId],
    references: [events.id],
  }),
  members: many(networkingGroupMembers),
  messages: many(networkingMessages),
  mindMapNodes: many(networkingMindMapNodes),
}));

export const networkingGroupMembersRelations = relations(networkingGroupMembers, ({ one }) => ({
  group: one(networkingGroups, {
    fields: [networkingGroupMembers.groupId],
    references: [networkingGroups.id],
  }),
  user: one(users, {
    fields: [networkingGroupMembers.userId],
    references: [users.id],
  }),
}));

export const networkingMessagesRelations = relations(networkingMessages, ({ one }) => ({
  group: one(networkingGroups, {
    fields: [networkingMessages.groupId],
    references: [networkingGroups.id],
  }),
  user: one(users, {
    fields: [networkingMessages.userId],
    references: [users.id],
  }),
}));

export const networkingMindMapNodesRelations = relations(networkingMindMapNodes, ({ one }) => ({
  group: one(networkingGroups, {
    fields: [networkingMindMapNodes.groupId],
    references: [networkingGroups.id],
  }),
  createdBy: one(users, {
    fields: [networkingMindMapNodes.createdByUserId],
    references: [users.id],
  }),
}));

//===================================================================
// EVENT SESSION RELATIONS
//===================================================================

export const eventSessionsRelations = relations(eventSessions, ({ one, many }) => ({
  event: one(events, {
    fields: [eventSessions.eventId],
    references: [events.id],
  }),
  sessionSpeakers: many(sessionSpeakers),
  upvotes: many(sessionUpvotes),
  comments: many(sessionComments),
}));

//===================================================================
// SESSION ↔ SPEAKER JOIN TABLE RELATIONS
//===================================================================

export const sessionSpeakersRelations = relations(sessionSpeakers, ({ one }) => ({
  session: one(eventSessions, {
    fields: [sessionSpeakers.sessionId],
    references: [eventSessions.id],
  }),
  user: one(users, {
    fields: [sessionSpeakers.userId],
    references: [users.id],
  }),
}));

//===================================================================
// SESSION UPVOTE RELATIONS
//===================================================================

export const sessionUpvotesRelations = relations(
  sessionUpvotes,
  ({ one }) => ({
    user: one(users, {
      fields: [sessionUpvotes.userId],
      references: [users.id],
    }),
    session: one(eventSessions, {
      fields: [sessionUpvotes.sessionId],
      references: [eventSessions.id],
    }),
  })
);

//===================================================================
// SESSION COMMENT RELATIONS
//===================================================================

export const sessionCommentsRelations = relations(
  sessionComments,
  ({ one }) => ({
    session: one(eventSessions, {
      fields: [sessionComments.sessionId],
      references: [eventSessions.id],
    }),
    user: one(users, {
      fields: [sessionComments.userId],
      references: [users.id],
    }),
  })
);

//====================================================================
// EVENT RELATIONS
//====================================================================

export const eventsRelations = relations(events, ({ many }) => ({
  sessions: many(eventSessions),
  eventAttendees: many(eventAttendees),
  networkingGroups: many(networkingGroups),
}));

export const eventAttendeesRelations = relations(eventAttendees, ({ one }) => ({
  event: one(events, {
    fields: [eventAttendees.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventAttendees.userId],
    references: [users.id],
  }),
}));
