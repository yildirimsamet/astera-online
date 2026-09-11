-- D2 v7: the live ledgers are not the only copies of Dominion. Lifetime account
-- counters and frozen clan recaps must keep the same exact-number contract.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM accounts WHERE
    (lifetime ? 'dominionTaken' AND CASE
      WHEN jsonb_typeof(lifetime -> 'dominionTaken') = 'number' THEN
        (lifetime ->> 'dominionTaken')::numeric <> trunc((lifetime ->> 'dominionTaken')::numeric)
        OR (lifetime ->> 'dominionTaken')::numeric NOT BETWEEN 0 AND 9007199254740991
      ELSE true
    END)
    OR (lifetime ? 'dominionLost' AND CASE
      WHEN jsonb_typeof(lifetime -> 'dominionLost') = 'number' THEN
        (lifetime ->> 'dominionLost')::numeric <> trunc((lifetime ->> 'dominionLost')::numeric)
        OR (lifetime ->> 'dominionLost')::numeric NOT BETWEEN 0 AND 9007199254740991
      ELSE true
    END)
  ) THEN
    RAISE EXCEPTION 'Dominion migration requires non-negative safe integer lifetime counters';
  END IF;

  IF EXISTS (SELECT 1 FROM season_results
    WHERE recap #> '{clan,dominion}' IS NOT NULL
      AND CASE
        WHEN jsonb_typeof(recap #> '{clan,dominion}') = 'number' THEN
          (recap #>> '{clan,dominion}')::numeric
            <> trunc((recap #>> '{clan,dominion}')::numeric)
          OR (recap #>> '{clan,dominion}')::numeric
            NOT BETWEEN -9007199254740991 AND 9007199254740991
        ELSE true
      END
  ) THEN
    RAISE EXCEPTION 'Dominion migration requires safe integer clan recap values';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_lifetime_dominion_range_check" CHECK (
  (NOT ("lifetime" ? 'dominionTaken') OR (
    jsonb_typeof("lifetime" -> 'dominionTaken') = 'number'
    AND ("lifetime" ->> 'dominionTaken')::numeric = trunc(("lifetime" ->> 'dominionTaken')::numeric)
    AND ("lifetime" ->> 'dominionTaken')::numeric BETWEEN 0 AND 9007199254740991
  ))
  AND (NOT ("lifetime" ? 'dominionLost') OR (
    jsonb_typeof("lifetime" -> 'dominionLost') = 'number'
    AND ("lifetime" ->> 'dominionLost')::numeric = trunc(("lifetime" ->> 'dominionLost')::numeric)
    AND ("lifetime" ->> 'dominionLost')::numeric BETWEEN 0 AND 9007199254740991
  ))
);
--> statement-breakpoint
ALTER TABLE "season_results" ADD CONSTRAINT "season_results_recap_clan_dominion_range_check" CHECK (
  ("recap" #> '{clan,dominion}') IS NULL
  OR (
    jsonb_typeof("recap" #> '{clan,dominion}') = 'number'
    AND ("recap" #>> '{clan,dominion}')::numeric
      = trunc(("recap" #>> '{clan,dominion}')::numeric)
    AND ("recap" #>> '{clan,dominion}')::numeric
      BETWEEN -9007199254740991 AND 9007199254740991
  )
);
