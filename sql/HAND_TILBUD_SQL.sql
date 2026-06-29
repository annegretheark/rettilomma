-- Hand tilbudsmodul
-- Kjor denne i Supabase SQL editor for du bruker Tilbud-siden.
-- Tabellenavnene har tydelig Hand-prefiks.

create extension if not exists pgcrypto;

create table if not exists public.hand_tilbud (
  id uuid primary key default gen_random_uuid(),
  tilbud_nr text,
  kunde_id uuid not null,
  prosjekt_id uuid,
  dato date not null default current_date,
  gyldig_til date,
  status text not null default 'utkast' check (status in (
    'utkast',
    'sendt',
    'akseptert',
    'avslatt',
    'utlopt',
    'konvertert_til_prosjekt'
  )),
  sum_eks_mva numeric(12,2) not null default 0,
  mva numeric(12,2) not null default 0,
  sum_inkl_mva numeric(12,2) not null default 0,
  notat text,
  opprettet timestamptz not null default now(),
  endret timestamptz not null default now()
);

create table if not exists public.hand_tilbud_linje (
  id uuid primary key default gen_random_uuid(),
  tilbud_id uuid not null references public.hand_tilbud(id) on delete cascade,
  sortering integer not null default 1,
  tekst text not null,
  antall numeric(12,2) not null default 1,
  enhet text not null default 'stk',
  pris numeric(12,2) not null default 0,
  mva_prosent numeric(5,2) not null default 25,
  sum_eks_mva numeric(12,2) not null default 0,
  mva numeric(12,2) not null default 0,
  sum_inkl_mva numeric(12,2) not null default 0,
  opprettet timestamptz not null default now()
);

create table if not exists public.hand_tilbud_vedlegg (
  id uuid primary key default gen_random_uuid(),
  tilbud_id uuid not null references public.hand_tilbud(id) on delete cascade,
  filnavn text not null,
  filsti text not null,
  mime_type text,
  opprettet timestamptz not null default now()
);

create index if not exists hand_tilbud_kunde_id_idx on public.hand_tilbud(kunde_id);
create index if not exists hand_tilbud_prosjekt_id_idx on public.hand_tilbud(prosjekt_id);
create index if not exists hand_tilbud_status_idx on public.hand_tilbud(status);
create index if not exists hand_tilbud_linje_tilbud_id_idx on public.hand_tilbud_linje(tilbud_id);

-- Enkel RLS-start. Juster policyene etter hvordan resten av Hand er satt opp.
alter table public.hand_tilbud enable row level security;
alter table public.hand_tilbud_linje enable row level security;
alter table public.hand_tilbud_vedlegg enable row level security;

create policy "hand_tilbud_auth_all" on public.hand_tilbud
  for all to authenticated using (true) with check (true);

create policy "hand_tilbud_linje_auth_all" on public.hand_tilbud_linje
  for all to authenticated using (true) with check (true);

create policy "hand_tilbud_vedlegg_auth_all" on public.hand_tilbud_vedlegg
  for all to authenticated using (true) with check (true);
