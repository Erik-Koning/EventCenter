ALTER TABLE "attendees" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "speakers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "attendees" CASCADE;--> statement-breakpoint
DROP TABLE "speakers" CASCADE;--> statement-breakpoint
ALTER TABLE "event_attendees" RENAME COLUMN "attendee_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "session_speakers" RENAME COLUMN "speaker_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "event_attendees" DROP CONSTRAINT "event_attendees_attendee_id_attendees_id_fk";
--> statement-breakpoint
ALTER TABLE "session_speakers" DROP CONSTRAINT "session_speakers_speaker_id_speakers_id_fk";
--> statement-breakpoint
DROP INDEX "event_attendees_event_attendee_idx";--> statement-breakpoint
DROP INDEX "event_attendees_attendee_id_idx";--> statement-breakpoint
DROP INDEX "session_speakers_session_speaker_idx";--> statement-breakpoint
DROP INDEX "session_speakers_speaker_id_idx";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "title" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "initials" varchar(10);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "interests" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_speaker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD CONSTRAINT "event_attendees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_speakers" ADD CONSTRAINT "session_speakers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_attendees_event_user_idx" ON "event_attendees" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_attendees_user_id_idx" ON "event_attendees" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_speakers_session_user_idx" ON "session_speakers" USING btree ("session_id","user_id");--> statement-breakpoint
CREATE INDEX "session_speakers_user_id_idx" ON "session_speakers" USING btree ("user_id");