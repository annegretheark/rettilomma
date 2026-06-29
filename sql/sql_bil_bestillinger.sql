-- Rett i Lomma - bilbestillinger / restordre
-- Kjor i Supabase SQL Editor for handverker.

create table if not exists public.bil_bestillinger (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid,
  bil_id uuid,
  bil_navn text,
  vare_id uuid,
  varenr text,
  varenavn text,
  bestilt numeric default 0,
  levert numeric default 0,
  rest numeric default 0,
  status text default 'venter',
  hentet_av text,
  bruker_id uuid,
  bruker_epost text,
  bruker_navn text,
  hovedlager_for numeric,
  hovedlager_etter numeric,
  opprettet timestamptz default now()
);

alter table public.bil_bestillinger enable row level security;

-- Systemadmin kan se og endre alt.
drop policy if exists "bil_bestillinger systemadmin all" on public.bil_bestillinger;
create policy "bil_bestillinger systemadmin all"
on public.bil_bestillinger
for all
to authenticated
using (public.er_systemadmin())
with check (public.er_systemadmin());

-- Firmaadmin/ansatte kan opprette bestilling i eget firma.
drop policy if exists "bil_bestillinger insert eget firma" on public.bil_bestillinger;
create policy "bil_bestillinger insert eget firma"
on public.bil_bestillinger
for insert
to authenticated
with check (
  firma_id in (
    select a.firma_id
    from public.ansatte a
    where a.user_id = auth.uid()
       or lower(a.epost) = lower(auth.jwt() ->> 'email')
  )
  or public.er_systemadmin()
);

-- Firmaadmin/ansatte kan lese bestillinger i eget firma.
drop policy if exists "bil_bestillinger select eget firma" on public.bil_bestillinger;
create policy "bil_bestillinger select eget firma"
on public.bil_bestillinger
for select
to authenticated
using (
  firma_id in (
    select a.firma_id
    from public.ansatte a
    where a.user_id = auth.uid()
       or lower(a.epost) = lower(auth.jwt() ->> 'email')
  )
  or public.er_systemadmin()
);

-- Firmaadmin kan oppdatere status i eget firma.
drop policy if exists "bil_bestillinger update eget firma admin" on public.bil_bestillinger;
create policy "bil_bestillinger update eget firma admin"
on public.bil_bestillinger
for update
to authenticated
using (
  public.er_systemadmin()
  or exists (
    select 1
    from public.ansatte a
    where (a.user_id = auth.uid() or lower(a.epost) = lower(auth.jwt() ->> 'email'))
      and a.firma_id = bil_bestillinger.firma_id
      and a.aktiv is not false
      and lower(coalesce(a.rolle, '')) in ('admin','firmaadmin','systemadmin')
  )
)
with check (
  public.er_systemadmin()
  or exists (
    select 1
    from public.ansatte a
    where (a.user_id = auth.uid() or lower(a.epost) = lower(auth.jwt() ->> 'email'))
      and a.firma_id = bil_bestillinger.firma_id
      and a.aktiv is not false
      and lower(coalesce(a.rolle, '')) in ('admin','firmaadmin','systemadmin')
  )
);
