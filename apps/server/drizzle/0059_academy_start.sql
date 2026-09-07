ALTER TABLE "planets" ADD COLUMN "academy_step" integer;
ALTER TABLE "planets" ADD CONSTRAINT "planets_academy_step_check" CHECK ("academy_step" IS NULL OR "academy_step" BETWEEN 0 AND 40);
