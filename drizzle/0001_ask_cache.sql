CREATE TABLE "ask_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_normalized" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"intent" text NOT NULL,
	"search_query" text NOT NULL,
	"result_count" integer NOT NULL,
	"included_count" integer NOT NULL,
	"sources" jsonb NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_hit_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ask_cache_question_normalized_uidx" ON "ask_cache" USING btree ("question_normalized");