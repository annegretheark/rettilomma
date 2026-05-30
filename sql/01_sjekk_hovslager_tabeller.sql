-- 01_sjekk_hovslager_tabeller.sql
-- KJØRES I HOVSLAGER-BASEN FØRST.
-- Viser hvilke tabeller/kolonner som finnes, og om hovslager-tabellene er der.

-- A) Oversikt over alle tabeller i public
select
  table_schema,
  table_name,
  table_type
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- B) Kolonner for relevante hovslager-tabeller
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'kunder',
    'firma',
    'hester',
    'hov_jobber',
    'hov_fakturaer',
    'hov_kreditnotaer',
    'faktura_varer'
  )
order by table_name, ordinal_position;

-- C) Antall rader i hovslager-tabellene, hvis de finnes
select 'kunder' as tabell, count(*) as antall from public.kunder
union all
select 'firma', count(*) from public.firma
union all
select 'hester', count(*) from public.hester
union all
select 'hov_jobber', count(*) from public.hov_jobber
union all
select 'hov_fakturaer', count(*) from public.hov_fakturaer
union all
select 'hov_kreditnotaer', count(*) from public.hov_kreditnotaer;

-- D) Foreign keys og constraints for relevante tabeller
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name as references_table,
  ccu.column_name as references_column
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.table_schema = kcu.table_schema
left join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.table_schema = tc.table_schema
where tc.table_schema = 'public'
  and tc.table_name in (
    'kunder',
    'firma',
    'hester',
    'hov_jobber',
    'hov_fakturaer',
    'hov_kreditnotaer',
    'faktura_varer'
  )
order by tc.table_name, tc.constraint_type, tc.constraint_name;
