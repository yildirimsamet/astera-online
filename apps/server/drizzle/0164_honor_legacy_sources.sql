ALTER TABLE "honor_seasons" ADD COLUMN "legacy_sources" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
-- Repair only genuinely earlier, still-pending flights in an existing shadow
-- catalogue. Equal timestamps cannot establish launch order retrospectively.
UPDATE "honor_seasons" AS h
SET "legacy_sources" = ARRAY(
  SELECT DISTINCT s.key FROM (
    SELECT 'WORLD:' || m.id::text AS key, 'WORLD' AS source, m.id::text AS source_id
    FROM missions m
    WHERE m.season_id = h.season_id AND m.kind = 'attack' AND m.status = 'in_flight' AND m.depart_at < h.created_at
    UNION ALL
    SELECT 'CLAN_WAR:' || m.id::text, 'CLAN_WAR', m.id::text
    FROM missions m JOIN clan_war_missions w ON w.mission_id = m.id
    WHERE m.season_id = h.season_id AND m.status = 'in_flight' AND w.leg = 'COMBINED_ATTACK' AND m.depart_at < h.created_at
    UNION ALL
    SELECT 'MONUMENT:' || COALESCE(w.joint_operation_id, w.id)::text, 'MONUMENT', COALESCE(w.joint_operation_id, w.id)::text
    FROM monument_waves w
    WHERE w.season_id = h.season_id AND w.status = 'OUTBOUND' AND w.purpose = 'ATTACK' AND w.sent_at < h.created_at
  ) s
  WHERE NOT EXISTS (SELECT 1 FROM honor_commitments c WHERE c.season_id = h.season_id AND c.source = s.source AND c.source_id = s.source_id)
  ORDER BY s.key
)
WHERE h.mode = 'SHADOW' AND h.closed_at IS NULL;
