-- Hestebehandler / Rett i Lomma
-- Kjor denne i Supabase SQL Editor for a opprette tabeller, sikkerhetsregler og storage.
--
-- Oppsettet er laget for appen i denne pakken. Alle tabeller krever innlogget bruker
-- via Supabase Auth. Opprett minst en bruker i Authentication -> Users.

create extension if not exists pgcrypto;

create or replace function public.beh_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.beh_kunder (
  id uuid primary key default gen_random_uuid(),
  navn text not null,
  adresse text default '',
  epost text default '',
  telefon text default '',
  kontaktperson text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.beh_hester (
  id uuid primary key default gen_random_uuid(),
  kunde_id uuid references public.beh_kunder(id) on delete cascade,
  navn text not null,
  rase text default '',
  notater text default '',
  sist_skodd date,
  neste_besok date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.beh_behandlinger (
  id uuid primary key default gen_random_uuid(),
  kunde_id uuid references public.beh_kunder(id) on delete set null,
  hest_id uuid references public.beh_hester(id) on delete set null,
  dato date not null default current_date,
  behandlingtype text default '',
  beskrivelse text default '',
  km numeric(10, 2) not null default 0,
  km_pris numeric(10, 2) not null default 0,
  arbeid_belop numeric(12, 2) not null default 0,
  varer_belop numeric(12, 2) not null default 0,
  mva numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  fakturert boolean not null default false,
  fakturanr text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.beh_behandling_bilder (
  id uuid primary key default gen_random_uuid(),
  behandling_id uuid references public.beh_behandlinger(id) on delete cascade,
  filnavn text default '',
  filsti text default '',
  bilde_url text default '',
  bildetekst text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.beh_fakturaer (
  id uuid primary key default gen_random_uuid(),
  fakturanr text unique not null,
  kunde_id uuid references public.beh_kunder(id) on delete set null,
  eks_mva numeric(12, 2) not null default 0,
  mva numeric(12, 2) not null default 0,
  inkl_mva numeric(12, 2) not null default 0,
  betalingsstatus text not null default 'ubetalt',
  kreditert boolean not null default false,
  kreditert_dato date,
  kreditnota_nr text,
  purring_sendt boolean not null default false,
  purring_dato date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.beh_kreditnotaer (
  id uuid primary key default gen_random_uuid(),
  kreditnotanr text unique not null,
  fakturanr text,
  kunde_id uuid references public.beh_kunder(id) on delete set null,
  eks_mva numeric(12, 2) not null default 0,
  mva numeric(12, 2) not null default 0,
  inkl_mva numeric(12, 2) not null default 0,
  grunn text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.beh_priser (
  id uuid primary key default gen_random_uuid(),
  navn text not null,
  pris numeric(12, 2) not null default 0,
  sortering integer not null default 0,
  aktiv boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.beh_firma (
  id uuid primary key default gen_random_uuid(),
  navn text default '',
  firmanavn text default '',
  adresse text default '',
  telefon text default '',
  epost text default '',
  orgnr text default '',
  org_nr text default '',
  mva_nr text default '',
  kontonr text default '',
  kontonummer text default '',
  vipps_nummer text default '',
  vipps_mottaker text default '',
  logo_url text default '',
  brevhode_tekst text default '',
  brevfot_tekst text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  tabell text;
begin
  foreach tabell in array array[
    'beh_kunder',
    'beh_hester',
    'beh_behandlinger',
    'beh_behandling_bilder',
    'beh_fakturaer',
    'beh_kreditnotaer',
    'beh_priser',
    'beh_firma'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', tabell);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.beh_set_updated_at()',
      tabell
    );
    execute format('alter table public.%I enable row level security', tabell);
    execute format('drop policy if exists beh_authenticated_all on public.%I', tabell);
    execute format(
      'create policy beh_authenticated_all on public.%I for all to authenticated using (true) with check (true)',
      tabell
    );
  end loop;
end $$;

create index if not exists beh_hester_kunde_idx on public.beh_hester(kunde_id);
create index if not exists beh_behandlinger_dato_idx on public.beh_behandlinger(dato desc);
create index if not exists beh_behandlinger_kunde_idx on public.beh_behandlinger(kunde_id);
create index if not exists beh_behandlinger_hest_idx on public.beh_behandlinger(hest_id);
create index if not exists beh_behandlinger_fakturanr_idx on public.beh_behandlinger(fakturanr);
create index if not exists beh_fakturaer_fakturanr_idx on public.beh_fakturaer(fakturanr);
create index if not exists beh_priser_sortering_idx on public.beh_priser(sortering, navn);

insert into public.beh_priser (navn, pris, sortering, aktiv)
select 'Behandling', 0, 10, true
where not exists (select 1 from public.beh_priser);

insert into storage.buckets (id, name, public)
values ('bilder', 'bilder', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists beh_bilder_select on storage.objects;
drop policy if exists beh_bilder_insert on storage.objects;
drop policy if exists beh_bilder_update on storage.objects;
drop policy if exists beh_bilder_delete on storage.objects;

create policy beh_bilder_select
on storage.objects for select
to authenticated
using (bucket_id = 'bilder');

create policy beh_bilder_insert
on storage.objects for insert
to authenticated
with check (bucket_id = 'bilder');

create policy beh_bilder_update
on storage.objects for update
to authenticated
using (bucket_id = 'bilder')
with check (bucket_id = 'bilder');

create policy beh_bilder_delete
on storage.objects for delete
to authenticated
using (bucket_id = 'bilder');
