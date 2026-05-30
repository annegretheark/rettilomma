-- Veterinær: komplett SQL for priser, kjøring, journalbilder og varer
-- Kan kjøres flere ganger.

alter table vet_journal
add column if not exists pris_id uuid;

alter table vet_journal
add column if not exists km_pris numeric(10,2) default 5.30;

alter table vet_journal
add column if not exists belop_eks_mva numeric(10,2) default 0;

create table if not exists vet_priser (
    id uuid primary key default gen_random_uuid(),
    navn text not null,
    type text not null default 'fastpris',
    pris numeric(10,2) default 0,
    beskrivelse text,
    aktiv boolean default true,
    created_at timestamptz default now()
);

create table if not exists vet_journal_bilder (
    id uuid primary key default gen_random_uuid(),
    journal_id uuid references vet_journal(id) on delete cascade,
    filnavn text,
    lagringssti text,
    bilde_url text,
    bildetekst text,
    created_at timestamptz default now()
);

create table if not exists vet_journal_varer (
    id uuid primary key default gen_random_uuid(),
    journal_id uuid references vet_journal(id) on delete cascade,
    varenavn text not null,
    antall numeric(10,2) default 1,
    pris numeric(10,2) default 0,
    sum_eks_mva numeric(10,2) default 0,
    created_at timestamptz default now()
);

insert into vet_priser (navn, type, pris, beskrivelse)
select 'Kjøring pr km', 'kmpris', 5.30, 'Standard kjøregodtgjørelse'
where not exists (select 1 from vet_priser where lower(navn) = lower('Kjøring pr km'));

insert into vet_priser (navn, type, pris, beskrivelse)
select 'Konsultasjon', 'fastpris', 1200, 'Standard konsultasjon'
where not exists (select 1 from vet_priser where lower(navn) = lower('Konsultasjon'));

insert into vet_priser (navn, type, pris, beskrivelse)
select 'Timearbeid', 'timepris', 1500, 'Standard timepris'
where not exists (select 1 from vet_priser where lower(navn) = lower('Timearbeid'));
