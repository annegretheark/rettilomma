-- Hovslager: første innloggede bruker får automatisk eget firma/admin
-- Kjør i Supabase SQL Editor før du publiserer filene.

create table if not exists public.hov_firma (
  id uuid primary key default gen_random_uuid(),
  navn text,
  epost text,
  telefon text,
  adresse text,
  orgnr text,
  created_at timestamptz default now()
);

alter table public.hov_firma add column if not exists rolle text default 'admin';
alter table public.hov_firma add column if not exists er_admin boolean default true;

alter table public.hov_firma enable row level security;

drop policy if exists "hov_firma egen epost" on public.hov_firma;

create policy "hov_firma egen epost"
on public.hov_firma
for all
to authenticated
using (lower(epost) = lower(auth.jwt() ->> 'email'))
with check (lower(epost) = lower(auth.jwt() ->> 'email'));
