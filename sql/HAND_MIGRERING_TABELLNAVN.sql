-- HAND MIGRERING: omdøp gamle Hand-tabeller til hand_-navn
-- Kjør først når JavaScript-koden i denne zip-en er lagt ut.
-- Ta Supabase backup før kjøring.

begin;

alter table if exists public.ansatte rename to hand_ansatt;
alter table if exists public.ansatt_trekk rename to hand_ansatt_trekk;
alter table if exists public.trekk_typer rename to hand_trekk_type;
alter table if exists public.firma rename to hand_firma;
alter table if exists public.firma_brukere rename to hand_firma_bruker;
alter table if exists public.kunder rename to hand_kunde;
alter table if exists public.prosjekter rename to hand_prosjekt;
alter table if exists public.timer rename to hand_time;
alter table if exists public.timer_bilder rename to hand_time_bilde;
alter table if exists public.fakturaer rename to hand_faktura;
alter table if exists public.faktura_varer rename to hand_faktura_vare;
alter table if exists public.faktura_utlegg rename to hand_faktura_utlegg;
alter table if exists public.varer rename to hand_vare;
alter table if exists public.biler rename to hand_bil;
alter table if exists public.bil_lager rename to hand_bil_lager;
alter table if exists public.bil_varer rename to hand_bil_vare;
alter table if exists public.bil_bestillinger rename to hand_bil_bestilling;
alter table if exists public.fravaer rename to hand_fravaer;
alter table if exists public.timebank rename to hand_timebank;
alter table if exists public.lonnskjoring rename to hand_lonnskjoring;
alter table if exists public.lager_bestillinger rename to hand_lager_bestilling;
alter table if exists public.lager_bevegelser rename to hand_lager_bevegelse;
alter table if exists public.lagerlogg rename to hand_lagerlogg;
alter table if exists public.innkjopsvarsler rename to hand_innkjopsvarsel;

commit;
