-- Kjor denne i Supabase SQL Editor hvis appen sier at hand_firma ikke kan leses.
-- Den lar innloggede brukere lese firma/kunder. Strammere policy kan lages etterpå.

alter table public.hand_firma enable row level security;

drop policy if exists "hand_firma_select_authenticated" on public.hand_firma;
create policy "hand_firma_select_authenticated"
on public.hand_firma
for select
to authenticated
using (true);

-- Hvis ny firmaoppretting fra appen ogsa skal virke for innlogget sysadmin:
drop policy if exists "hand_firma_insert_authenticated" on public.hand_firma;
create policy "hand_firma_insert_authenticated"
on public.hand_firma
for insert
to authenticated
with check (true);

drop policy if exists "hand_firma_update_authenticated" on public.hand_firma;
create policy "hand_firma_update_authenticated"
on public.hand_firma
for update
to authenticated
using (true)
with check (true);
