-- Faz 0 cohort read, 2026-11-13. Read-only: ssh -T yildirim@hoofywood.com 'docker exec -i -e PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=30000" astera-postgres-prod psql -U astera -d astera' < this-file
-- Results are in docs/yeni-oyuncu-yolculugu-plani-2026-11-13.md §10.4. Admin usernames come from ADMIN_USERNAMES in ~/astera/.env.

-- ── cohort ──
\pset footer off
with cohort as (
  select a.id, a.username, a.created_at, a.starter_guide_off_at,
    v.id vid, v.status vstatus, v.enlisted_at, v.modules, v.facts, v.last_seen_at vseen, v.last_progress_at vprog,
    p.main_entered_at, p.last_active_at, p.last_progress_at pprog, p.newcomer_shield_until, s.role shard_role, s.name shard_name
  from accounts a
  left join vessels v on v.account_id = a.id
  left join players p on p.account_id = a.id
  left join seasons se on se.id = p.season_id
  left join shards s on s.id = se.shard_id
  where a.created_at >= '2026-11-10'
    and not exists (select 1 from bot_profiles b where b.account_id = a.id)
    and not exists (select 1 from vessel_bot_state bs where bs.vessel_id = v.id)
    and a.username not in ('adminlesh','adminlloyd')
)
select date_trunc('day', created_at)::date as gun, count(*) signups,
  count(vid) enlisted,
  count(*) filter (where coalesce((modules->>'REFINERY')::int,0) >= 2) refinery2,
  count(*) filter (where facts ? 'FIRST_MINING_SENT') mine_sent,
  count(*) filter (where facts ? 'FIRST_MINING_RETURN') mine_ret,
  count(*) filter (where facts ? 'FIRST_PROBE_REPORT') probe,
  count(*) filter (where coalesce((modules->>'SHIPYARD')::int,0) >= 1) yard,
  count(*) filter (where facts ? 'FIRST_BATTLE_REPORT') battle,
  count(*) filter (where vstatus = 'DEPARTED') departed,
  count(*) filter (where main_entered_at is not null) in_main,
  count(*) filter (where shard_role = 'WAITING') silent_now
from cohort group by 1 order by 1;

-- ── players ──
\pset footer off
with cohort as (
  select a.id, a.username, a.created_at, a.starter_guide_off_at, v.id vid, v.status, v.modules, v.facts, v.last_seen_at, v.last_progress_at, v.enlisted_at
  from accounts a join vessels v on v.account_id = a.id
  where a.created_at >= '2026-11-10'
    and not exists (select 1 from bot_profiles b where b.account_id = a.id)
    and not exists (select 1 from vessel_bot_state bs where bs.vessel_id = v.id)
    and a.username not in ('adminlesh','adminlloyd')
)
select row_number() over (order by created_at) n,
  to_char(created_at at time zone 'Europe/Istanbul','DD HH24:MI') kayit,
  round(extract(epoch from (last_seen_at - created_at))/60) seen_min,
  round(extract(epoch from (last_progress_at - created_at))/60) prog_min,
  round(extract(epoch from (now() - last_seen_at))/3600) idle_h,
  (select count(*) from vessel_orders o where o.vessel_id = c.vid and o.ordered_at is not null) orders,
  (select count(*) from vessel_missions m where m.owner_vessel_id = c.vid) missions,
  starter_guide_off_at is not null guide_off,
  (select string_agg(k||v, ' ' order by k) from jsonb_each_text(modules) as e(k,v) where k in ('REFINERY','EXTRACTOR','TELESCOPE','RADAR','SURVEY','SHIPYARD','DOCK')) mods,
  (select string_agg(replace(f #>> '{}','FIRST_',''), ',') from jsonb_array_elements(facts) f) facts
from cohort c order by created_at;

-- ── events ──
\pset footer off
with cohort as (
  select a.id, a.created_at from accounts a join vessels v on v.account_id = a.id
  where a.created_at >= '2026-11-10'
    and not exists (select 1 from bot_profiles b where b.account_id = a.id)
    and not exists (select 1 from vessel_bot_state bs where bs.vessel_id = v.id)
    and a.username not in ('adminlesh','adminlloyd')
)
select row_number() over (order by c.created_at) n,
  count(e.id) events,
  count(distinct e.session_id) sessions,
  round(extract(epoch from (max(e.occurred_at) - c.created_at))/60) last_evt_min,
  round(extract(epoch from (max(e.occurred_at) filter (where e.occurred_at > c.created_at + interval '1 hour') - c.created_at))/3600, 1) last_after1h_h,
  count(*) filter (where e.name = 'client_error') errs,
  string_agg(distinct e.properties->>'code', ',') filter (where e.name = 'client_error') err_codes,
  (array_agg(e.properties->>'scene' order by e.occurred_at desc) filter (where e.name in ('training_scene_visible','training_exit_requested')))[1] last_scene,
  (array_agg(coalesce(e.properties->>'surface', e.properties->>'code') order by e.occurred_at desc) filter (where e.name = 'surface_visible'))[1] last_surface,
  (array_agg(e.name order by e.occurred_at desc))[1] last_event
from cohort c left join analytics_events e on e.account_id = c.id
group by c.id, c.created_at order by c.created_at;

-- ── timeline ──
\pset footer off
with cohort as (
  select a.id, a.created_at, v.id vid from accounts a join vessels v on v.account_id = a.id
  where a.created_at >= '2026-11-10'
    and not exists (select 1 from bot_profiles b where b.account_id = a.id)
    and not exists (select 1 from vessel_bot_state bs where bs.vessel_id = v.id)
    and a.username not in ('adminlesh','adminlloyd')
), n as (select *, row_number() over (order by created_at) n from cohort)
select n.n,
  (select max(e.occurred_at) from analytics_events e where e.account_id = n.id and e.source='client_observation') as lastc,
  (select string_agg(o.subject||o.stage||'@'||round(extract(epoch from o.ordered_at - n.created_at))||'s→'||round(extract(epoch from o.ready_at - o.ordered_at))||'s'||case when o.status<>'DONE' then '('||o.status||')' else '' end, ' ' order by o.ordered_at) from vessel_orders o where o.vessel_id = n.vid and o.ordered_at < n.created_at + interval '20 minutes') orders,
  (select string_agg(m.kind||'@'||round(extract(epoch from m.ordered_at - n.created_at))||'s→'||round(extract(epoch from coalesce(m.return_at,m.arrive_at) - m.ordered_at))||'s'||case when m.status<>'DONE' then '('||m.status||')' else '' end, ' ' order by m.ordered_at) from vessel_missions m where m.owner_vessel_id = n.vid and m.ordered_at < n.created_at + interval '20 minutes') missions
from n where n.n in (1,3,4,5,6,9,10,11,12,13,15,18,19,20,21,22,23,25,26,7) order by n.n;

-- ── silent ──
\pset footer off
select s.role, count(*) total,
  count(*) filter (where a.created_at >= now() - interval '30 days') joined_30d,
  count(*) filter (where p.newcomer_shield_until > p.main_entered_at and a.created_at >= now() - interval '30 days') had_shield_30d
from players p join accounts a on a.id = p.account_id join seasons se on se.id = p.season_id join shards s on s.id = se.shard_id
where not exists (select 1 from bot_profiles b where b.account_id = a.id) and a.username not in ('adminlesh','adminlloyd')
group by s.role order by 1;
select count(*) filter (where a.created_at >= '2026-10-14' and a.created_at < '2026-11-10') signups_4w_before,
  count(*) filter (where a.created_at >= '2026-11-10') signups_since
from accounts a where not exists (select 1 from bot_profiles b where b.account_id = a.id);

-- ── older ──
\pset footer off
with c as (
  select a.id, a.created_at, p.last_active_at, p.last_progress_at from accounts a left join players p on p.account_id = a.id
  where a.created_at >= '2026-10-14' and a.created_at < '2026-11-10'
    and not exists (select 1 from bot_profiles b where b.account_id = a.id) and a.username not in ('adminlesh','adminlloyd')
)
select count(*) signups, count(last_active_at) with_player,
  count(*) filter (where last_progress_at - created_at >= interval '1 hour') prog_1h,
  count(*) filter (where last_progress_at - created_at >= interval '24 hours') prog_24h,
  count(*) filter (where last_progress_at - created_at >= interval '72 hours') prog_72h,
  count(*) filter (where last_progress_at - created_at >= interval '7 days') prog_7d
from c;
