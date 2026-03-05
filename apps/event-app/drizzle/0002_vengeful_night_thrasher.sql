ALTER TABLE "attendees" ADD COLUMN "is_speaker" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "attendees" ADD COLUMN "company" varchar(255);--> statement-breakpoint
ALTER TABLE "attendees" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "attendees" ADD COLUMN "interests" text;--> statement-breakpoint
ALTER TABLE "event_attendees" ADD COLUMN "role" varchar(50) DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "networking_groups" ADD COLUMN "event_id" varchar(255);--> statement-breakpoint
ALTER TABLE "networking_groups" ADD COLUMN "co_creator_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "current_event_id" varchar(255);--> statement-breakpoint
ALTER TABLE "networking_groups" ADD CONSTRAINT "networking_groups_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_current_event_id_events_id_fk" FOREIGN KEY ("current_event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "networking_groups_event_id_idx" ON "networking_groups" USING btree ("event_id");