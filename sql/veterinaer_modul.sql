-- Veterinærmodul første versjon
-- Kjør i Supabase SQL Editor før du åpner veterinærmodulen.

create table if not exists vet_klinikker (
  id uuid primary key default gen_random_uuid(),
  navn text not null,
  konsern_navn text,
  telefon text,
  epost text,
  adresse text,
  created_at timestamptz not null default now()
);

create table if not exists vet_dyreeiere (
  id uuid primary key default gen_random_uuid(),
  klinikk_id uuid references vet_klinikker(id) on delete set null,
  navn text not null,
  telefon text,
  epost text,
  adresse text,
  created_at timestamptz not null default now()
);

create table if not exists vet_dyr (
  id uuid primary key default gen_random_uuid(),
  klinikk_id uuid references vet_klinikker(id) on delete set null,
  dyreeier_id uuid references vet_dyreeiere(id) on delete cascade,
  navn text not null,
  art text,
  rase text,
  fodselsdato date,
  kjonn text,
  idmerking text,
  created_at timestamptz not null default now()
);

create table if not exists vet_journal (
  id uuid primary key default gen_random_uuid(),
  klinikk_id uuid references vet_klinikker(id) on delete set null,
  dyr_id uuid references vet_dyr(id) on delete cascade,
  dato date not null default current_date,
  type text,
  notat text not null,
  medisin_kladd text,
  opprettet_av uuid,
  created_at timestamptz not null default now()
);

-- Modulvalg i firma-tabellen hvis ikke dette allerede er kjørt.
alter table firma add column if not exists moduler jsonb default '{}'::jsonb;
alter table firma add column if not exists moduler_konfigurert boolean default false;

-- OBS: RLS skrur vi på samlet senere når firma_id/klinikk_id-strukturen er bestemt.
