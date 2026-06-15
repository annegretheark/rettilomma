-- Rett i Lomma - Hestebehandler
-- Fikser feilen: Could not find the table public.beh_behandlinger in the schema cache

create extension if not exists pgcrypto;

create table if not exists public.beh_behandlinger (
  id uuid primary key default gen_random_uuid(),
  kunde_id uuid references public.beh_kunder(id) on delete set null,
  hest_id uuid references public.beh_hester(id) on delete set null,
  dato date not null default current_date,
  behandlingtype text,
  beskrivelse text,
  km numeric default 0,
  km_pris numeric default 0,
  arbeid_belop numeric default 0,
  varer_belop numeric default 0,
  mva numeric default 0,
  total numeric default 0,
  fakturert boolean default false,
  faktura_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.beh_behandling_bilder (
  id uuid primary key default gen_random_uuid(),
  behandling_id uuid references public.beh_behandlinger(id) on delete cascade,
  filnavn text,
  filsti text,
  bilde_url text,
  bildetekst text,
  created_at timestamptz not null default now()
);

create index if not exists beh_behandlinger_kunde_id_idx on public.beh_behandlinger(kunde_id);
create index if not exists beh_behandlinger_hest_id_idx on public.beh_behandlinger(hest_id);
create index if not exists beh_behandlinger_dato_idx on public.beh_behandlinger(dato);
create index if not exists beh_behandling_bilder_behandling_id_idx on public.beh_behandling_bilder(behandling_id);

-- Hvis RLS senere skrus på, finnes policyene allerede.
alter table public.beh_behandlinger disable row level security;
alter table public.beh_behandling_bilder disable row level security;

drop policy if exists "beh_behandlinger les alle innloggede" on public.beh_behandlinger;
drop policy if exists "beh_behandlinger lagre alle innloggede" on public.beh_behandlinger;
drop policy if exists "beh_behandlinger oppdater alle innloggede" on public.beh_behandlinger;
drop policy if exists "beh_behandlinger slett alle innloggede" on public.beh_behandlinger;

create policy "beh_behandlinger les alle innloggede"
on public.beh_behandlinger for select to authenticated using (true);

create policy "beh_behandlinger lagre alle innloggede"
on public.beh_behandlinger for insert to authenticated with check (true);

create policy "beh_behandlinger oppdater alle innloggede"
on public.beh_behandlinger for update to authenticated using (true) with check (true);

create policy "beh_behandlinger slett alle innloggede"
on public.beh_behandlinger for delete to authenticated using (true);

drop policy if exists "beh_behandling_bilder les alle innloggede" on public.beh_behandling_bilder;
drop policy if exists "beh_behandling_bilder lagre alle innloggede" on public.beh_behandling_bilder;
drop policy if exists "beh_behandling_bilder oppdater alle innloggede" on public.beh_behandling_bilder;
drop policy if exists "beh_behandling_bilder slett alle innloggede" on public.beh_behandling_bilder;

create policy "beh_behandling_bilder les alle innloggede"
on public.beh_behandling_bilder for select to authenticated using (true);

create policy "beh_behandling_bilder lagre alle innloggede"
on public.beh_behandling_bilder for insert to authenticated with check (true);

create policy "beh_behandling_bilder oppdater alle innloggede"
on public.beh_behandling_bilder for update to authenticated using (true) with check (true);

create policy "beh_behandling_bilder slett alle innloggede"
on public.beh_behandling_bilder for delete to authenticated using (true);

-- Tving PostgREST/Supabase til å lese schema på nytt.
notify pgrst, 'reload schema';

select 'OK - beh_behandlinger og beh_behandling_bilder er klare' as status;
