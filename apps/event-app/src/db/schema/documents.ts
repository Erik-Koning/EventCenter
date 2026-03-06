/**
 * Session Documents Schema - File metadata for uploaded session documents
 */

import {
  pgTable,
  pgEnum,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { eventSessions } from "./sessions";

export const documentCategoryEnum = pgEnum("document_category", [
  "speaker_document",
  "transcript_note",
]);

export const sessionDocuments = pgTable(
  "session_documents",
  {
    id: varchar("id", { length: 255 }).primaryKey(),
    sessionId: varchar("session_id", { length: 255 })
      .notNull()
      .references(() => eventSessions.id, { onDelete: "cascade" }),
    uploadedById: varchar("uploaded_by_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileName: varchar("file_name", { length: 500 }).notNull(),
    fileSize: integer("file_size").notNull(),
    contentType: varchar("content_type", { length: 255 }).notNull(),
    blobUrl: text("blob_url").notNull(),
    category: documentCategoryEnum("category").default("speaker_document").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("session_documents_session_id_idx").on(table.sessionId),
    index("session_documents_uploaded_by_id_idx").on(table.uploadedById),
  ]
);
