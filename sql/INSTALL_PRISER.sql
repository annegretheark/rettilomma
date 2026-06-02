-- Hovslager faste priser
-- Kjør dette i Supabase SQL Editor først.

create table if not exists hov_priser (
  id uuid primary key default gen_random_uuid(),
  navn text not null,
  pris numeric(12,2) not null default 0,
  aktiv boolean not null default true,
  sortering integer not null default 0,
  created_at timestamptz default now()
);

create unique index if not exists hov_priser_navn_unik
on hov_priser (navn);

insert into hov_priser (navn, pris, aktiv, sortering) values
('Fullbeslag', 1800, true, 10),
('Forsko', 1100, true, 20),
('Baksko', 1100, true, 30),
('Barfot/verking', 650, true, 40),
('Enkeltsko', 350, true, 50),
('Såler', 300, true, 60),
('Brodder', 150, true, 70),
('Kjøring pr km', 5.30, true, 80),
('Annet', 0, true, 90)
on conflict (navn) do update
set
  pris = excluded.pris,
  aktiv = excluded.aktiv,
  sortering = excluded.sortering;
