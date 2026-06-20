-- Reparer fakturaoversikt uten aa kjoere hele oppsettet paa nytt.
-- Kjoer denne i Supabase SQL Editor hvis "Vis alle fakturaer og status" viser tomt.

alter table public.beh_behandlinger add column if not exists behandler_id uuid references public.beh_behandlere(id) on delete set null;
alter table public.beh_behandlinger add column if not exists fakturanr text;
alter table public.beh_behandlinger add column if not exists fakturert boolean not null default false;

alter table public.beh_fakturaer add column if not exists fakturanr text;
alter table public.beh_fakturaer add column if not exists kunde_id uuid references public.beh_kunder(id) on delete set null;
alter table public.beh_fakturaer add column if not exists behandler_id uuid references public.beh_behandlere(id) on delete set null;
alter table public.beh_fakturaer add column if not exists dato date default current_date;
alter table public.beh_fakturaer add column if not exists eks_mva numeric(12, 2) not null default 0;
alter table public.beh_fakturaer add column if not exists mva numeric(12, 2) not null default 0;
alter table public.beh_fakturaer add column if not exists inkl_mva numeric(12, 2) not null default 0;
alter table public.beh_fakturaer add column if not exists betalt boolean not null default false;
alter table public.beh_fakturaer add column if not exists betalt_belop numeric(12, 2) not null default 0;
alter table public.beh_fakturaer add column if not exists betalt_dato date;
alter table public.beh_fakturaer add column if not exists betalingsstatus text not null default 'ubetalt';
alter table public.beh_fakturaer add column if not exists kreditert boolean not null default false;
alter table public.beh_fakturaer add column if not exists kreditert_dato date;
alter table public.beh_fakturaer add column if not exists kreditnota_nr text;
alter table public.beh_fakturaer add column if not exists purring_sendt boolean not null default false;
alter table public.beh_fakturaer add column if not exists purring_dato date;

create index if not exists beh_behandlinger_fakturanr_idx on public.beh_behandlinger(fakturanr);
create index if not exists beh_behandlinger_behandler_idx on public.beh_behandlinger(behandler_id);
create index if not exists beh_fakturaer_fakturanr_idx on public.beh_fakturaer(fakturanr);
create index if not exists beh_fakturaer_behandler_idx on public.beh_fakturaer(behandler_id);

update public.beh_behandlinger b
set kunde_id = h.kunde_id
from public.beh_hester h
where b.hest_id = h.id
  and b.kunde_id is null
  and h.kunde_id is not null;

update public.beh_behandlinger b
set behandler_id = k.behandler_id
from public.beh_kunder k
where b.kunde_id = k.id
  and b.behandler_id is null
  and k.behandler_id is not null;

update public.beh_behandlinger b
set behandler_id = h.behandler_id
from public.beh_hester h
where b.hest_id = h.id
  and b.behandler_id is null
  and h.behandler_id is not null;

update public.beh_fakturaer f
set behandler_id = k.behandler_id
from public.beh_kunder k
where f.kunde_id = k.id
  and f.behandler_id is null
  and k.behandler_id is not null;

update public.beh_fakturaer f
set behandler_id = x.behandler_id
from (
  select fakturanr, min(behandler_id::text)::uuid as behandler_id
  from public.beh_behandlinger
  where fakturanr is not null
    and fakturanr <> ''
    and behandler_id is not null
  group by fakturanr
) x
where f.fakturanr = x.fakturanr
  and f.behandler_id is null;

update public.beh_behandlinger
set fakturanr = 'REPARERT-' || to_char(current_date, 'YYYYMMDD') || '-' || left(id::text, 8)
where fakturert is true
  and (fakturanr is null or fakturanr = '');

with summer as (
  select
    b.fakturanr,
    min(b.kunde_id::text)::uuid as kunde_id,
    min(coalesce(b.dato, current_date)) as dato,
    min(b.behandler_id::text)::uuid as behandler_id,
    sum(
      case
        when coalesce(b.total, 0) <> 0 then coalesce(b.total, 0) / 1.25
        else coalesce(b.arbeid_belop, 0) + coalesce(b.varer_belop, 0) + (coalesce(b.km, 0) * coalesce(b.km_pris, 0))
      end
    ) as eks_mva,
    sum(
      case
        when coalesce(b.mva, 0) <> 0 then coalesce(b.mva, 0)
        when coalesce(b.total, 0) <> 0 then coalesce(b.total, 0) - (coalesce(b.total, 0) / 1.25)
        else (coalesce(b.arbeid_belop, 0) + coalesce(b.varer_belop, 0) + (coalesce(b.km, 0) * coalesce(b.km_pris, 0))) * 0.25
      end
    ) as mva,
    sum(
      case
        when coalesce(b.total, 0) <> 0 then coalesce(b.total, 0)
        else (coalesce(b.arbeid_belop, 0) + coalesce(b.varer_belop, 0) + (coalesce(b.km, 0) * coalesce(b.km_pris, 0))) * 1.25
      end
    ) as inkl_mva
  from public.beh_behandlinger b
  where b.fakturert is true
    and b.fakturanr is not null
    and b.fakturanr <> ''
  group by b.fakturanr
)
insert into public.beh_fakturaer (
  fakturanr,
  kunde_id,
  dato,
  eks_mva,
  mva,
  inkl_mva,
  betalingsstatus,
  behandler_id
)
select
  s.fakturanr,
  s.kunde_id,
  s.dato,
  round(s.eks_mva::numeric, 2),
  round(s.mva::numeric, 2),
  round(s.inkl_mva::numeric, 2),
  'ubetalt',
  s.behandler_id
from summer s
where not exists (
  select 1
  from public.beh_fakturaer f
  where f.fakturanr = s.fakturanr
);

with summer as (
  select
    b.fakturanr,
    min(b.kunde_id::text)::uuid as kunde_id,
    min(coalesce(b.dato, current_date)) as dato,
    min(b.behandler_id::text)::uuid as behandler_id,
    sum(
      case
        when coalesce(b.total, 0) <> 0 then coalesce(b.total, 0) / 1.25
        else coalesce(b.arbeid_belop, 0) + coalesce(b.varer_belop, 0) + (coalesce(b.km, 0) * coalesce(b.km_pris, 0))
      end
    ) as eks_mva,
    sum(
      case
        when coalesce(b.mva, 0) <> 0 then coalesce(b.mva, 0)
        when coalesce(b.total, 0) <> 0 then coalesce(b.total, 0) - (coalesce(b.total, 0) / 1.25)
        else (coalesce(b.arbeid_belop, 0) + coalesce(b.varer_belop, 0) + (coalesce(b.km, 0) * coalesce(b.km_pris, 0))) * 0.25
      end
    ) as mva,
    sum(
      case
        when coalesce(b.total, 0) <> 0 then coalesce(b.total, 0)
        else (coalesce(b.arbeid_belop, 0) + coalesce(b.varer_belop, 0) + (coalesce(b.km, 0) * coalesce(b.km_pris, 0))) * 1.25
      end
    ) as inkl_mva
  from public.beh_behandlinger b
  where b.fakturert is true
    and b.fakturanr is not null
    and b.fakturanr <> ''
  group by b.fakturanr
)
update public.beh_fakturaer f
set
  kunde_id = coalesce(f.kunde_id, s.kunde_id),
  dato = coalesce(f.dato, s.dato),
  eks_mva = case when coalesce(f.eks_mva, 0) = 0 then round(s.eks_mva::numeric, 2) else f.eks_mva end,
  mva = case when coalesce(f.mva, 0) = 0 then round(s.mva::numeric, 2) else f.mva end,
  inkl_mva = case when coalesce(f.inkl_mva, 0) = 0 then round(s.inkl_mva::numeric, 2) else f.inkl_mva end,
  behandler_id = coalesce(f.behandler_id, s.behandler_id),
  betalingsstatus = coalesce(nullif(f.betalingsstatus, ''), 'ubetalt')
from summer s
where f.fakturanr = s.fakturanr;
