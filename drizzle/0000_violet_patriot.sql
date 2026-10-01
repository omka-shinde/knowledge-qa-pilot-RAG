CREATE TABLE "knowledge_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"category" text,
	"source_document" text NOT NULL,
	"source_page" integer,
	"searchable_content" text NOT NULL,
	"question_normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "knowledge_entries_question_normalized_uidx" ON "knowledge_entries" USING btree ("question_normalized");--> statement-breakpoint
CREATE INDEX "knowledge_entries_source_document_idx" ON "knowledge_entries" USING btree ("source_document");--> statement-breakpoint
CREATE INDEX "knowledge_entries_searchable_content_fts_idx" ON "knowledge_entries" USING gin (to_tsvector('english', "searchable_content"));