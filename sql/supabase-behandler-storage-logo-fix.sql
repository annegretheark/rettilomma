-- Kjør denne hvis logo ikke lar seg laste opp.
insert into storage.buckets (id, name, public)
values ('bilder', 'bilder', true)
on conflict (id) do update set public = true;

drop policy if exists "bilder authenticated read" on storage.objects;
drop policy if exists "bilder authenticated insert" on storage.objects;
drop policy if exists "bilder authenticated update" on storage.objects;
drop policy if exists "bilder authenticated delete" on storage.objects;

create policy "bilder authenticated read"
on storage.objects for select to authenticated
using (bucket_id = 'bilder');

create policy "bilder authenticated insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'bilder');

create policy "bilder authenticated update"
on storage.objects for update to authenticated
using (bucket_id = 'bilder') with check (bucket_id = 'bilder');

create policy "bilder authenticated delete"
on storage.objects for delete to authenticated
using (bucket_id = 'bilder');
