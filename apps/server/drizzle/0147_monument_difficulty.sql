ALTER TABLE "monuments" DROP CONSTRAINT "monuments_ordinal_check";--> statement-breakpoint
ALTER TABLE "monuments" ADD COLUMN "difficulty" text DEFAULT 'LEGACY' NOT NULL;--> statement-breakpoint
ALTER TABLE "monuments" ADD CONSTRAINT "monuments_difficulty_check" CHECK ("monuments"."difficulty" IN ('LEGACY', 'EASY', 'HARD'));--> statement-breakpoint
ALTER TABLE "monuments" ADD CONSTRAINT "monuments_ordinal_check" CHECK ("monuments"."ordinal" BETWEEN 1 AND 8);