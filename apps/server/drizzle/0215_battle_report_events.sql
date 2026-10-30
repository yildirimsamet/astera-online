-- A REPORT FILED IS SAID TO ITS ATTACKER. Scaling plan F1.8 (C5).
--
-- Two Frontier rungs are found by battle (a cargo-limited raid, a shield that held),
-- and a planet read now remembers what a commander's reports have taught them. Four
-- writers file reports; a trigger cannot be forgotten by a fifth. It fires on insert,
-- before the raid's own result is published in the same transaction, so the read
-- that result provokes already sees the rung. Clients ignore the kind.
CREATE FUNCTION "astera_report_filed"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('astera_events', json_build_object('playerId', NEW.attacker_player_id, 'kind', 'private:report')::text);
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER "battle_reports_filed" AFTER INSERT ON "battle_reports"
  FOR EACH ROW EXECUTE FUNCTION "astera_report_filed"();
