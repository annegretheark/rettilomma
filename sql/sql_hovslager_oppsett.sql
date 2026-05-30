-- Kjor denne i Supabase SQL editor for hovslager-basen

alter table firma
add column if not exists logo_url text,
add column if not exists orgnr text,
add column if not exists mva_nr text,
add column if not exists telefon text,
add column if not exists brevhode_tekst text,
add column if not exists brevfot_tekst text;

insert into firma (
  navn,
  logo_url,
  brevhode_tekst,
  brevfot_tekst
)
select
  'Mitt firma',
  'bilder/logo.png',
  '',
  ''
where not exists (
  select 1 from firma
);
