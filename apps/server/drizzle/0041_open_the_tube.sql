-- T10. `type` was pinned to a single value because there was only ever one kind of
-- strategic asset. The interception grid is the second: same lifecycle, same
-- transfer-with-the-world behaviour, same one-moment consumption — so it belongs in
-- this table rather than in a second one that would need its own cleanup lists.
ALTER TABLE "strategic_assets" DROP CONSTRAINT "strategic_assets_type_check";--> statement-breakpoint
ALTER TABLE "strategic_assets" ADD CONSTRAINT "strategic_assets_type_check"
  CHECK ("strategic_assets"."type" IN ('DEATH_STAR', 'INTERCEPTOR'));
