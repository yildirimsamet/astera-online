-- İniş sonrası ilk saat ölçümü (docs/inis-sonrasi-ilk-saat-plani-2026-11-20.md §8). Salt okunur; yalnız toplamlar, kimlik yok.
-- Çalıştırma: ssh -T yildirim@hoofywood.com 'docker exec -i -e PGOPTIONS="-c default_transaction_read_only=on -c statement_timeout=30000" astera-postgres-prod psql -U astera -d astera -v since="2026-11-19 03:35+00"' < bu-dosya
-- `since`: kohortun ilk kayıt anı. Admin kullanıcı adları ~/astera/.env içindeki ADMIN_USERNAMES'tan gelir.
\if :{?since}
\else
\set since '2026-11-19 03:35+00'
\endif
\pset footer off

-- Salt okunur işlemde geçici görünüm kurulamaz; her sorgu kohortunu kendi CTE'sinde taşır.

\echo '== 1. Huni: kayıttan ana galaksiye =='
with c as (
  select a.id, a.created_at, v.modules m, v.facts f, v.status vs, p.main_entered_at
  from accounts a left join vessels v on v.account_id = a.id left join players p on p.account_id = a.id
  where a.created_at >= :'since'
    and not exists (select 1 from bot_profiles b where b.account_id = a.id)
    and not exists (select 1 from vessel_bot_state bs where bs.vessel_id = v.id)
    and a.username not in ('adminlesh','adminlloyd')
)
select count(*) kayit,
  count(*) filter (where coalesce((m->>'REFINERY')::int,0) >= 2) ilk_onarim,
  count(*) filter (where coalesce((m->>'TELESCOPE')::int,0) >= 1) teleskop,
  count(*) filter (where coalesce((m->>'SHIPYARD')::int,0) >= 1) tersane,
  count(*) filter (where f ? 'FIRST_MINING_RETURN' and f ? 'FIRST_PROBE_REPORT' and coalesce((m->>'SHIPYARD')::int,0) >= 1) pencere,
  count(*) filter (where main_entered_at is not null or vs = 'DEPARTED') ana_galaksi
from c;

\echo '== 2. İnişten sonraki ilk 5 dakikada elle verilen komut (hedef: en az 3) =='
with j as (
  select a.id, p.main_entered_at from accounts a join players p on p.account_id = a.id
  where a.created_at >= :'since' and p.main_entered_at is not null
    and not exists (select 1 from bot_profiles b where b.account_id = a.id)
    and a.username not in ('adminlesh','adminlloyd')
), k as (
  select j.id, count(e.id) filter (where e.occurred_at < j.main_entered_at + interval '5 minutes') ilk5,
    max(greatest(e.occurred_at, j.main_entered_at)) son_iz
  from j left join analytics_events e on e.account_id = j.id and e.occurred_at >= j.main_entered_at
    and e.name = 'command_accepted' and e.source = 'server_fact'
  group by j.id
)
select count(*) inen, count(*) filter (where ilk5 >= 3) ilk5_en_az_3, count(*) filter (where ilk5 = 0) ilk5_hic
from k;

\echo '== 3. İnişten sonra etkinlik süresi (12 saat kuralı: 12 saattir iz yoksa bıraktı) =='
with j as (
  select a.id, p.main_entered_at, p.last_active_at from accounts a join players p on p.account_id = a.id
  where a.created_at >= :'since' and p.main_entered_at is not null
    and not exists (select 1 from bot_profiles b where b.account_id = a.id)
    and a.username not in ('adminlesh','adminlloyd')
), t as (
  select j.*, greatest(j.last_active_at, (select max(e.occurred_at) from analytics_events e where e.account_id = j.id)) son
  from j
)
select count(*) inen,
  count(*) filter (where son - main_entered_at < interval '15 minutes') ilk15dk_icinde_son_iz,
  count(*) filter (where son - main_entered_at >= interval '1 hour') bir_saatten_fazla,
  count(*) filter (where son < now() - interval '12 hours') birakti_12sa,
  count(*) filter (where son >= now() - interval '12 hours') hala_aktif_veya_belirsiz
from t;

\echo '== 4. İnişten sonraki 10 dakikada kendiliğinden açılan yüzeyler ve kapanış biçimi =='
with j as (
  select a.id, p.main_entered_at from accounts a join players p on p.account_id = a.id
  where a.created_at >= :'since' and p.main_entered_at is not null
    and not exists (select 1 from bot_profiles b where b.account_id = a.id)
    and a.username not in ('adminlesh','adminlloyd')
)
select e.name, e.properties->>'surface' yuzey, coalesce(e.properties->>'code','') kod,
  count(distinct e.account_id) hesap, count(*) adet,
  round(percentile_cont(0.5) within group (order by extract(epoch from (e.occurred_at - j.main_entered_at)))::numeric) medyan_sn
from analytics_events e join j on j.id = e.account_id
where e.occurred_at >= j.main_entered_at and e.occurred_at < j.main_entered_at + interval '10 minutes'
  and e.name in ('surface_visible', 'surface_closed', 'outcome_visible')
group by 1, 2, 3 order by 1, hesap desc;
