ALTER TABLE "accounts" ADD COLUMN "first_season_started_at" timestamp with time zone;
--> statement-breakpoint
-- Retained participation and archives identify prior players without consuming the
-- opening of an existing account that has never joined. Lifetime seasons covers
-- older wiped worlds whose individual participation receipts were not retained.
UPDATE "accounts" AS account
SET "first_season_started_at" = history.started_at
FROM (
  SELECT account_id, min(started_at) AS started_at
  FROM (
    SELECT account_id, joined_at AS started_at FROM players
    UNION ALL
    SELECT account_id, joined_at AS started_at FROM legacy_participation
    UNION ALL
    SELECT account_id, created_at AS started_at FROM season_results
    UNION ALL
    SELECT id AS account_id, created_at AS started_at FROM accounts
      WHERE (lifetime -> 'seasons') > '0'::jsonb
  ) AS receipts
  GROUP BY account_id
) AS history
WHERE account.id = history.account_id;
