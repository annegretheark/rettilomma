-- Kjør i Supabase SQL Editor.
-- Gir åpen demo lov til å merke egne demojobber som fakturert.
-- Endrer bare demo-firmaet.

alter table public.hov_jobber enable row level security;

drop policy if exists "demo hov_jobber update faktura" on public.hov_jobber;
create policy "demo hov_jobber update faktura"
on public.hov_jobber
for update
to anon, authenticated
using (firma_id = '133fb053-b585-45e2-b730-3f58bf4b8d2e')
with check (firma_id = '133fb053-b585-45e2-b730-3f58bf4b8d2e');

-- Hvis select også mangler for demoen, behold/legg til denne:
drop policy if exists "demo hov_jobber select" on public.hov_jobber;
create policy "demo hov_jobber select"
on public.hov_jobber
for select
to anon, authenticated
using (firma_id = '133fb053-b585-45e2-b730-3f58bf4b8d2e');
