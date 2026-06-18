-- Test-policy for behandler: priser, behandlinger og bilder.
-- Kjor i Supabase SQL Editor hvis appen ikke finner priser eller ikke får lagret bilder.

do $$
declare
  tabell text;
begin
  foreach tabell in array array[
    'beh_priser',
    'beh_behandlinger',
    'beh_behandling_bilder',
    'beh_hester',
    'beh_kunder'
  ]
  loop
    execute format('alter table public.%I enable row level security', tabell);
    execute format('drop policy if exists beh_authenticated_all on public.%I', tabell);
    execute format('drop policy if exists beh_test_all on public.%I', tabell);
    execute format(
      'create policy beh_test_all on public.%I for all to anon, authenticated using (true) with check (true)',
      tabell
    );
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values ('bilder', 'bilder', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists beh_bilder_select on storage.objects;
drop policy if exists beh_bilder_insert on storage.objects;
drop policy if exists beh_bilder_update on storage.objects;
drop policy if exists beh_bilder_delete on storage.objects;
drop policy if exists beh_bilder_test_all on storage.objects;

create policy beh_bilder_test_all
on storage.objects
for all
to anon, authenticated
using (bucket_id = 'bilder')
with check (bucket_id = 'bilder');
