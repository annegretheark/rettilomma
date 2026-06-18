-- Test-policy for behandler: priser, behandlinger og bilder.
-- Kjor i Supabase SQL Editor hvis appen ikke finner priser eller ikke får lagret bilder.

create table if not exists public.beh_behandlere (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  navn text not null,
  epost text not null unique,
  orgnr text,
  fakturaadresse text,
  bankkonto text,
  fakturanotat text,
  rolle text not null default 'behandler',
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.beh_behandlere add column if not exists auth_user_id uuid;
alter table public.beh_behandlere add column if not exists navn text;
alter table public.beh_behandlere add column if not exists epost text;
alter table public.beh_behandlere add column if not exists orgnr text;
alter table public.beh_behandlere add column if not exists fakturaadresse text;
alter table public.beh_behandlere add column if not exists bankkonto text;
alter table public.beh_behandlere add column if not exists fakturanotat text;
alter table public.beh_behandlere add column if not exists rolle text not null default 'behandler';
alter table public.beh_behandlere add column if not exists aktiv boolean not null default true;
alter table public.beh_behandlere add column if not exists created_at timestamptz not null default now();
alter table public.beh_behandlere add column if not exists updated_at timestamptz not null default now();

create unique index if not exists beh_behandlere_epost_idx on public.beh_behandlere(lower(epost));

do $$
declare
  tabell text;
begin
  foreach tabell in array array[
    'beh_behandlere',
    'beh_priser',
    'beh_behandlinger',
    'beh_behandling_bilder',
    'beh_hester',
    'beh_kunder',
    'beh_fakturaer',
    'beh_kreditnotaer'
  ]
  loop
    execute format('alter table public.%I enable row level security', tabell);
    execute format('drop policy if exists beh_authenticated_all on public.%I', tabell);
    execute format('drop policy if exists beh_test_all on public.%I', tabell);
    execute format(
      'create policy beh_test_all on public.%I for all to anon, authenticated using (true) with check (true)',
      tabell
    );
  end loop;
end $$;

alter table public.beh_fakturaer add column if not exists dato date default current_date;
alter table public.beh_fakturaer add column if not exists betalt boolean not null default false;
alter table public.beh_fakturaer add column if not exists betalt_belop numeric(12, 2) not null default 0;
alter table public.beh_fakturaer add column if not exists betalt_dato date;
alter table public.beh_fakturaer add column if not exists betalingsstatus text not null default 'ubetalt';
alter table public.beh_fakturaer add column if not exists kreditert boolean not null default false;
alter table public.beh_fakturaer add column if not exists kreditert_dato date;
alter table public.beh_fakturaer add column if not exists kreditnota_nr text;
alter table public.beh_fakturaer add column if not exists purring_sendt boolean not null default false;
alter table public.beh_fakturaer add column if not exists purring_dato date;

update public.beh_fakturaer
set dato = coalesce(dato, created_at::date, current_date)
where dato is null;

alter table public.beh_behandlinger add column if not exists fakturanr text;
alter table public.beh_behandlinger add column if not exists fakturert boolean not null default false;
create index if not exists beh_behandlinger_fakturanr_idx on public.beh_behandlinger(fakturanr);

insert into storage.buckets (id, name, public)
values ('bilder', 'bilder', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists beh_bilder_select on storage.objects;
drop policy if exists beh_bilder_insert on storage.objects;
drop policy if exists beh_bilder_update on storage.objects;
drop policy if exists beh_bilder_delete on storage.objects;
drop policy if exists beh_bilder_test_all on storage.objects;

create policy beh_bilder_test_all
on storage.objects
for all
to anon, authenticated
using (bucket_id = 'bilder')
with check (bucket_id = 'bilder');
