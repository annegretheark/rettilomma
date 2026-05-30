-- Veterinær: lagerplass for journalbilder
-- Kjør denne i Supabase SQL Editor.

-- 1. Storage-bucket for journalbilder
insert into storage.buckets (id, name, public)
values ('vet-bilder', 'vet-bilder', true)
on conflict (id) do update set public = true;

-- 2. Tabell som kobler bilder til journalnotat
-- Viktig: journal_id er uuid fordi vet_journal.id er uuid hos deg.
create table if not exists public.vet_journal_bilder (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.vet_journal(id) on delete cascade,
  filnavn text,
  lagringssti text,
  bilde_url text not null,
  bildetekst text,
  created_at timestamptz default now()
);

create index if not exists vet_journal_bilder_journal_id_idx
on public.vet_journal_bilder(journal_id);

alter table public.vet_journal_bilder enable row level security;

-- 3. Enkle policyer for innloggede brukere.
-- Siden hver kunde har egen database, er dette greit for første versjon.
drop policy if exists "vet_journal_bilder_select_authenticated" on public.vet_journal_bilder;
create policy "vet_journal_bilder_select_authenticated"
on public.vet_journal_bilder
for select
to authenticated
using (true);

drop policy if exists "vet_journal_bilder_insert_authenticated" on public.vet_journal_bilder;
create policy "vet_journal_bilder_insert_authenticated"
on public.vet_journal_bilder
for insert
to authenticated
with check (true);

drop policy if exists "vet_journal_bilder_update_authenticated" on public.vet_journal_bilder;
create policy "vet_journal_bilder_update_authenticated"
on public.vet_journal_bilder
for update
to authenticated
using (true)
with check (true);

drop policy if exists "vet_journal_bilder_delete_authenticated" on public.vet_journal_bilder;
create policy "vet_journal_bilder_delete_authenticated"
on public.vet_journal_bilder
for delete
to authenticated
using (true);

-- 4. Storage-policyer for bucket vet-bilder
drop policy if exists "vet_bilder_select_authenticated" on storage.objects;
create policy "vet_bilder_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'vet-bilder');

drop policy if exists "vet_bilder_insert_authenticated" on storage.objects;
create policy "vet_bilder_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'vet-bilder');

drop policy if exists "vet_bilder_update_authenticated" on storage.objects;
create policy "vet_bilder_update_authenticated"
on storage.objects
for update
to authenticated
using (bucket_id = 'vet-bilder')
with check (bucket_id = 'vet-bilder');

drop policy if exists "vet_bilder_delete_authenticated" on storage.objects;
create policy "vet_bilder_delete_authenticated"
on storage.objects
for delete
to authenticated
using (bucket_id = 'vet-bilder');
