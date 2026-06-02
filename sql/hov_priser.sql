
create table if not exists hov_priser (
  id uuid primary key default gen_random_uuid(),
  navn text not null unique,
  pris numeric(12,2) not null default 0,
  aktiv boolean not null default true
);

insert into hov_priser (navn, pris) values
('Fullbeslag',1800),
('Forsko',1100),
('Baksko',1100),
('Barfot/verking',650),
('Enkeltsko',350),
('Såler',300),
('Brodder',150)
on conflict (navn) do nothing;
