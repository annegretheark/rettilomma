-- Veterinær: klinikklogo, admin-oppsett og km-pris
-- Kan kjøres flere ganger.

alter table vet_klinikker
add column if not exists logo_url text;

alter table vet_klinikker
add column if not exists km_pris numeric(10,2) default 5.30;

-- Storage bucket for klinikklogoer.
-- Hvis denne feiler på grunn av rettigheter, opprett bucket manuelt i Supabase:
-- Storage -> New bucket -> vet-logoer -> Public bucket.
insert into storage.buckets (id, name, public)
values ('vet-logoer', 'vet-logoer', true)
on conflict (id) do update set public = true;

-- Enkel public read-policy. Upload gjøres av innlogget bruker.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Public read vet-logoer'
  ) then
    create policy "Public read vet-logoer"
    on storage.objects for select
    using (bucket_id = 'vet-logoer');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated upload vet-logoer'
  ) then
    create policy "Authenticated upload vet-logoer"
    on storage.objects for insert
    to authenticated
    with check (bucket_id = 'vet-logoer');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Authenticated update vet-logoer'
  ) then
    create policy "Authenticated update vet-logoer"
    on storage.objects for update
    to authenticated
    using (bucket_id = 'vet-logoer')
    with check (bucket_id = 'vet-logoer');
  end if;
end $$;
