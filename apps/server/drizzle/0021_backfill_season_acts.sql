-- PostgreSQL forbids using a new enum value in the transaction that adds it.
-- The new worker backfills missing live-season Act events after migrations commit,
-- under the season row lock; keeping this journal step makes the generated snapshot
-- chain explicit without putting data work in the unsafe DDL transaction.
SELECT 1;
