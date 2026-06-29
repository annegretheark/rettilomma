-- Dyrebehandler - sikker RLS per behandler
-- Kjor denne etter test-oppsettet nar appen skal brukes med flere behandlere.
-- Eksisterende rader uten eier legges pa greknuts/systemeier, slik at nye behandlere starter tomt.

create extension if not exists pgcrypto;

alter table public.beh_behandlere add column if not exists auth_user_id uuid;
alter table public.beh_behandlere add column if not exists rolle text not null default 'behandler';
alter table public.beh_behandlere add column if not exists aktiv boolean not null default true;

alter table public.beh_kunder add column if not exists behandler_id uuid references public.beh_behandlere(id) on delete set null;
alter table public.beh_hester add column if not exists behandler_id uuid references public.beh_behandlere(id) on delete set null;
alter table public.beh_behandlinger add column if not exists behandler_id uuid references public.beh_behandlere(id) on delete set null;
alter table public.beh_behandling_bilder add column if not exists behandler_id uuid references public.beh_behandlere(id) on delete set null;
alter table public.beh_fakturaer add column if not exists behandler_id uuid references public.beh_behandlere(id) on delete set null;
alter table public.beh_kreditnotaer add column if not exists behandler_id uuid references public.beh_behandlere(id) on delete set null;
alter table public.beh_priser add column if not exists behandler_id uuid references public.beh_behandlere(id) on delete set null;
alter table public.beh_firma add column if not exists behandler_id uuid references public.beh_behandlere(id) on delete set null;

create or replace function public.beh_auth_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.beh_current_behandler_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select b.id
  from public.beh_behandlere b
  where b.aktiv is not false
    and (
      b.auth_user_id = auth.uid()
      or lower(coalesce(b.epost, '')) = public.beh_auth_email()
    )
  order by
    case when b.auth_user_id = auth.uid() then 0 else 1 end,
    b.created_at asc nulls last
  limit 1;
$$;

create or replace function public.beh_is_systemeier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.beh_behandlere b
      where b.aktiv is not false
        and (
          b.auth_user_id = auth.uid()
          or lower(coalesce(b.epost, '')) = public.beh_auth_email()
        )
        and (
          lower(coalesce(b.rolle, '')) in ('systemeier', 'admin')
          or lower(coalesce(b.epost, '')) like '%greknuts%'
          or lower(coalesce(b.navn, '')) like '%greknuts%'
        )
    )
    or public.beh_auth_email() like '%greknuts%',
    false
  );
$$;

create or replace function public.beh_default_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.behandler_id is null then
    new.behandler_id := public.beh_current_behandler_id();
  end if;
  return new;
end;
$$;

do $$
declare
  tabell text;
begin
  foreach tabell in array array[
    'beh_kunder',
    'beh_hester',
    'beh_behandlinger',
    'beh_behandling_bilder',
    'beh_fakturaer',
    'beh_kreditnotaer',
    'beh_priser',
    'beh_firma'
  ]
  loop
    execute format('drop trigger if exists beh_default_owner_trigger on public.%I', tabell);
    execute format(
      'create trigger beh_default_owner_trigger before insert on public.%I for each row execute function public.beh_default_owner()',
      tabell
    );
  end loop;
end $$;

-- Greknuts/systemeier eier gamle testdata som ikke har eier.
do $$
declare
  v_owner uuid;
begin
  select id into v_owner
  from public.beh_behandlere
  where lower(coalesce(epost, '')) like '%greknuts%'
     or lower(coalesce(navn, '')) like '%greknuts%'
     or lower(coalesce(rolle, '')) in ('systemeier', 'admin')
  order by created_at asc nulls last
  limit 1;

  if v_owner is null then
    select id into v_owner
    from public.beh_behandlere
    order by created_at asc nulls last
    limit 1;
  end if;

  if v_owner is not null then
    update public.beh_behandlere
    set rolle = 'systemeier'
    where id = v_owner
      and lower(coalesce(rolle, '')) not in ('systemeier', 'admin');

    update public.beh_kunder set behandler_id = v_owner where behandler_id is null;
    update public.beh_hester set behandler_id = v_owner where behandler_id is null;
    update public.beh_behandlinger set behandler_id = v_owner where behandler_id is null;
    update public.beh_behandling_bilder set behandler_id = v_owner where behandler_id is null;
    update public.beh_fakturaer set behandler_id = v_owner where behandler_id is null;
    update public.beh_kreditnotaer set behandler_id = v_owner where behandler_id is null;
    update public.beh_priser set behandler_id = v_owner where behandler_id is null;
    update public.beh_firma set behandler_id = v_owner where behandler_id is null;
  end if;
end $$;

create index if not exists beh_kunder_behandler_idx on public.beh_kunder(behandler_id);
create index if not exists beh_hester_behandler_idx on public.beh_hester(behandler_id);
create index if not exists beh_behandlinger_behandler_idx on public.beh_behandlinger(behandler_id);
create index if not exists beh_behandling_bilder_behandler_idx on public.beh_behandling_bilder(behandler_id);
create index if not exists beh_fakturaer_behandler_idx on public.beh_fakturaer(behandler_id);
create index if not exists beh_kreditnotaer_behandler_idx on public.beh_kreditnotaer(behandler_id);
create index if not exists beh_priser_behandler_idx on public.beh_priser(behandler_id);
create index if not exists beh_firma_behandler_idx on public.beh_firma(behandler_id);

do $$
declare
  tabell text;
begin
  foreach tabell in array array[
    'beh_kunder',
    'beh_hester',
    'beh_behandlinger',
    'beh_behandling_bilder',
    'beh_fakturaer',
    'beh_kreditnotaer',
    'beh_priser',
    'beh_firma'
  ]
  loop
    execute format('alter table public.%I enable row level security', tabell);
    execute format('drop policy if exists beh_authenticated_all on public.%I', tabell);
    execute format('drop policy if exists beh_test_all on public.%I', tabell);
    execute format('drop policy if exists beh_owner_select on public.%I', tabell);
    execute format('drop policy if exists beh_owner_insert on public.%I', tabell);
    execute format('drop policy if exists beh_owner_update on public.%I', tabell);
    execute format('drop policy if exists beh_owner_delete on public.%I', tabell);

    execute format(
      'create policy beh_owner_select on public.%I for select to authenticated using (public.beh_is_systemeier() or behandler_id = public.beh_current_behandler_id())',
      tabell
    );
    execute format(
      'create policy beh_owner_insert on public.%I for insert to authenticated with check (public.beh_is_systemeier() or behandler_id = public.beh_current_behandler_id())',
      tabell
    );
    execute format(
      'create policy beh_owner_update on public.%I for update to authenticated using (public.beh_is_systemeier() or behandler_id = public.beh_current_behandler_id()) with check (public.beh_is_systemeier() or behandler_id = public.beh_current_behandler_id())',
      tabell
    );
    execute format(
      'create policy beh_owner_delete on public.%I for delete to authenticated using (public.beh_is_systemeier() or behandler_id = public.beh_current_behandler_id())',
      tabell
    );
  end loop;
end $$;

alter table public.beh_behandlere enable row level security;
drop policy if exists beh_authenticated_all on public.beh_behandlere;
drop policy if exists beh_test_all on public.beh_behandlere;
drop policy if exists beh_behandlere_select on public.beh_behandlere;
drop policy if exists beh_behandlere_insert on public.beh_behandlere;
drop policy if exists beh_behandlere_update on public.beh_behandlere;
drop policy if exists beh_behandlere_delete on public.beh_behandlere;

create policy beh_behandlere_select
on public.beh_behandlere
for select
to authenticated
using (
  public.beh_is_systemeier()
  or auth_user_id = auth.uid()
  or lower(coalesce(epost, '')) = public.beh_auth_email()
);

create policy beh_behandlere_insert
on public.beh_behandlere
for insert
to authenticated
with check (public.beh_is_systemeier());

create policy beh_behandlere_update
on public.beh_behandlere
for update
to authenticated
using (
  public.beh_is_systemeier()
  or auth_user_id = auth.uid()
  or lower(coalesce(epost, '')) = public.beh_auth_email()
)
with check (
  public.beh_is_systemeier()
  or auth_user_id = auth.uid()
  or lower(coalesce(epost, '')) = public.beh_auth_email()
);

create policy beh_behandlere_delete
on public.beh_behandlere
for delete
to authenticated
using (public.beh_is_systemeier());

-- Bilder: databasen stopper bilde-rader per behandler. Selve bucket er fortsatt public hvis du har satt den public.
-- For helt private bilder ma bucket gjores privat og appen ma bruke signerte lenker.
