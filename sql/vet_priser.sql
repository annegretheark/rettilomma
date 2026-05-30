-- Veterinær: prisliste + prisfelter på journal

create table if not exists vet_priser (
  id bigint generated always as identity primary key,
  navn text not null,
  type text not null default 'fastpris',
  pris numeric(10,2) not null default 0,
  beskrivelse text,
  aktiv boolean not null default true,
  created_at timestamptz not null default now()
);

alter table vet_journal
add column if not exists pris_id bigint references vet_priser(id);

alter table vet_journal
add column if not exists fastpris numeric(10,2) not null default 0;

alter table vet_journal
add column if not exists timepris numeric(10,2) not null default 0;

alter table vet_journal
add column if not exists timer numeric(10,2) not null default 0;

alter table vet_journal
add column if not exists km numeric(10,2) not null default 0;

alter table vet_journal
add column if not exists km_pris numeric(10,2) not null default 0;

alter table vet_journal
add column if not exists belop_eks_mva numeric(10,2) not null default 0;

insert into vet_priser (navn, type, pris, beskrivelse)
values
  ('Konsultasjon', 'fastpris', 1200, 'Standard konsultasjon'),
  ('Timearbeid', 'timepris', 1500, 'Arbeid per time'),
  ('Akuttvakt', 'timepris', 2200, 'Vakt / akutt'),
  ('Kjøring per km', 'kmpris', 6.50, 'Kilometersats')
on conflict do nothing;
