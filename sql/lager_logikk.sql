-- Lagerlogikk v2
-- Flyt: innkjøp/startlager -> hovedlager -> bil -> jobb/faktura
-- Kjør denne før du bruker lager-GUI.

-- Varer får pris og lagerfelter. Eksisterende kolonnen pris brukes som utpris eks. mva.
alter table varer add column if not exists innpris numeric default 0;
alter table varer add column if not exists paslag_faktor numeric default 3;
alter table varer add column if not exists pris numeric default 0;
alter table varer add column if not exists lager_antall numeric default 0;
alter table varer add column if not exists minimum_antall numeric default 0;
alter table varer add column if not exists mva_sats numeric default 25;
alter table varer add column if not exists aktiv boolean default true;

-- Bilregister
create table if not exists biler (
  id bigint generated always as identity primary key,
  navn text not null,
  regnr text,
  created_at timestamptz default now()
);

-- Varer som ligger i bil. varer.id er uuid i denne databasen.
create table if not exists bil_varer (
  id bigint generated always as identity primary key,
  bil_id bigint references biler(id) on delete cascade,
  vare_id uuid references varer(id) on delete cascade,
  antall numeric default 0,
  created_at timestamptz default now(),
  unique (bil_id, vare_id)
);

-- Historikk. Ikke nødvendig for faktura, men veldig nyttig når lageret skal spores.
create table if not exists lager_bevegelser (
  id bigint generated always as identity primary key,
  vare_id uuid references varer(id) on delete set null,
  bil_id bigint references biler(id) on delete set null,
  fra_type text,
  fra_id text,
  til_type text,
  til_id text,
  antall numeric not null default 0,
  type text,
  kommentar text,
  created_at timestamptz default now()
);

-- Praktiske indekser.
create index if not exists idx_bil_varer_bil_vare on bil_varer(bil_id, vare_id);
create index if not exists idx_lager_bevegelser_vare on lager_bevegelser(vare_id);
create index if not exists idx_lager_bevegelser_bil on lager_bevegelser(bil_id);

-- Standard bil per ansatt. Brukes som aktiv bil etter innlogging.
alter table ansatte add column if not exists standard_bil_id bigint references biler(id) on delete set null;


-- Antall skal være heltall. Dette hindrer 1,5 muffe og andre rare lagerverdier.
alter table varer alter column lager_antall type integer using round(coalesce(lager_antall, 0))::integer;
alter table varer alter column minimum_antall type integer using round(coalesce(minimum_antall, 0))::integer;
alter table bil_varer alter column antall type integer using round(coalesce(antall, 0))::integer;
alter table lager_bevegelser alter column antall type integer using round(coalesce(antall, 0))::integer;

alter table varer alter column lager_antall set default 0;
alter table varer alter column minimum_antall set default 0;
alter table bil_varer alter column antall set default 0;
alter table lager_bevegelser alter column antall set default 0;
