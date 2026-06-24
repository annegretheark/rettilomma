-- Håndverker: sikker firma- og kundetilgang.
-- Greknuts/sysadmin kan se alle firma.
-- Firma-admin og ansatte ser bare rader som hører til eget firma.

create or replace function public.hand_innlogget_epost()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.hand_er_sysadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.hand_innlogget_epost() = 'greknuts@online.no'
    or exists (
      select 1
      from public.hand_ansatt a
      where (
          a.user_id = auth.uid()
          or lower(coalesce(a.epost, '')) = public.hand_innlogget_epost()
        )
        and lower(coalesce(a.rolle, '')) in ('sysadmin', 'systemadmin')
    );
$$;

create or replace function public.hand_har_firma_tilgang(p_firma_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_firma_id is not null
    and (
      public.hand_er_sysadmin()
      or exists (
        select 1
        from public.hand_firma_bruker fb
        where fb.user_id = auth.uid()
          and fb.firma_id = p_firma_id
      )
      or exists (
        select 1
        from public.hand_ansatt a
        where a.firma_id = p_firma_id
          and (
            a.user_id = auth.uid()
            or lower(coalesce(a.epost, '')) = public.hand_innlogget_epost()
          )
      )
      or exists (
        select 1
        from public.hand_firma f
        where f.id = p_firma_id
          and lower(coalesce(f.epost, '')) = public.hand_innlogget_epost()
      )
    );
$$;

drop function if exists public.hand_har_kunde_tilgang(uuid);
drop function if exists public.hand_har_kunde_tilgang(text);

create or replace function public.hand_har_kunde_tilgang(p_kunde_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_kunde_id is not null
    and (
      public.hand_er_sysadmin()
      or exists (
        select 1
        from public.hand_kunde k
        where k.id::text = p_kunde_id
          and public.hand_har_firma_tilgang(k.firma_id)
      )
    );
$$;

-- Reparer manglende firma_id der koblingen kan utledes trygt.
do $$
begin
  if to_regclass('public.hand_ansatt') is not null
    and to_regclass('public.hand_firma') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'hand_ansatt' and column_name = 'firma_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'hand_ansatt' and column_name = 'epost'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'hand_firma' and column_name = 'epost'
    )
  then
    update public.hand_ansatt a
    set firma_id = f.id
    from public.hand_firma f
    where a.firma_id is null
      and coalesce(a.epost, '') <> ''
      and lower(coalesce(a.epost, '')) = lower(coalesce(f.epost, ''));
  end if;

  if to_regclass('public.hand_ansatt') is not null
    and to_regclass('public.hand_firma_bruker') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'hand_ansatt' and column_name = 'firma_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'hand_ansatt' and column_name = 'user_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'hand_firma_bruker' and column_name = 'user_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'hand_firma_bruker' and column_name = 'firma_id'
    )
  then
    update public.hand_ansatt a
    set firma_id = fb.firma_id
    from public.hand_firma_bruker fb
    where a.firma_id is null
      and a.user_id is not null
      and a.user_id = fb.user_id
      and fb.firma_id is not null;
  end if;

  if to_regclass('public.hand_ansatt') is not null
    and to_regclass('public.hand_firma_bruker') is not null
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'hand_ansatt' and column_name = 'firma_id'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'hand_ansatt' and column_name = 'epost'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'hand_firma_bruker' and column_name = 'epost'
    )
    and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'hand_firma_bruker' and column_name = 'firma_id'
    )
  then
    update public.hand_ansatt a
    set firma_id = fb.firma_id
    from public.hand_firma_bruker fb
    where a.firma_id is null
      and coalesce(a.epost, '') <> ''
      and lower(coalesce(a.epost, '')) = lower(coalesce(fb.epost, ''))
      and fb.firma_id is not null;
  end if;
end $$;

alter table public.hand_firma enable row level security;
alter table public.hand_kunde enable row level security;

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('hand_firma', 'hand_kunde')
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      r.policyname,
      r.schemaname,
      r.tablename
    );
  end loop;
end $$;

drop policy if exists "hand_firma_select_authenticated" on public.hand_firma;
drop policy if exists "hand_firma_insert_authenticated" on public.hand_firma;
drop policy if exists "hand_firma_update_authenticated" on public.hand_firma;
drop policy if exists "hand_firma_select_tenant" on public.hand_firma;
drop policy if exists "hand_firma_insert_tenant" on public.hand_firma;
drop policy if exists "hand_firma_update_tenant" on public.hand_firma;

create policy "hand_firma_select_tenant"
on public.hand_firma
for select
to authenticated
using (
  public.hand_er_sysadmin()
  or public.hand_har_firma_tilgang(id)
);

create policy "hand_firma_insert_tenant"
on public.hand_firma
for insert
to authenticated
with check (
  public.hand_er_sysadmin()
  or coalesce(epost, '') = ''
  or lower(coalesce(epost, '')) = public.hand_innlogget_epost()
);

create policy "hand_firma_update_tenant"
on public.hand_firma
for update
to authenticated
using (
  public.hand_er_sysadmin()
  or public.hand_har_firma_tilgang(id)
)
with check (
  public.hand_er_sysadmin()
  or public.hand_har_firma_tilgang(id)
);

drop policy if exists "hand_kunde_select_tenant" on public.hand_kunde;
drop policy if exists "hand_kunde_insert_tenant" on public.hand_kunde;
drop policy if exists "hand_kunde_update_tenant" on public.hand_kunde;
drop policy if exists "hand_kunde_delete_tenant" on public.hand_kunde;

create policy "hand_kunde_select_tenant"
on public.hand_kunde
for select
to authenticated
using (
  public.hand_er_sysadmin()
  or public.hand_har_firma_tilgang(firma_id)
);

create policy "hand_kunde_insert_tenant"
on public.hand_kunde
for insert
to authenticated
with check (
  public.hand_er_sysadmin()
  or public.hand_har_firma_tilgang(firma_id)
);

create policy "hand_kunde_update_tenant"
on public.hand_kunde
for update
to authenticated
using (
  public.hand_er_sysadmin()
  or public.hand_har_firma_tilgang(firma_id)
)
with check (
  public.hand_er_sysadmin()
  or public.hand_har_firma_tilgang(firma_id)
);

create policy "hand_kunde_delete_tenant"
on public.hand_kunde
for delete
to authenticated
using (
  public.hand_er_sysadmin()
  or public.hand_har_firma_tilgang(firma_id)
);

create index if not exists hand_kunde_firma_id_idx
on public.hand_kunde(firma_id);

create or replace function public.hand_er_firma_admin(p_firma_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_firma_id is not null
    and (
      public.hand_er_sysadmin()
      or exists (
        select 1
        from public.hand_ansatt a
        where a.firma_id = p_firma_id
          and (
            a.user_id = auth.uid()
            or lower(coalesce(a.epost, '')) = public.hand_innlogget_epost()
          )
          and lower(coalesce(a.rolle, '')) in ('admin', 'firmaadmin', 'systemadmin', 'sysadmin')
      )
      or exists (
        select 1
        from public.hand_firma f
        where f.id = p_firma_id
          and lower(coalesce(f.epost, '')) = public.hand_innlogget_epost()
      )
    );
$$;

-- Stram inn flere håndverker-tabeller hvis de finnes.
-- Dette gjør at API-et også følger samme firmafilter som skjermen.
do $$
declare
  t text;
  tilgang_expr text;
begin
  if to_regclass('public.hand_ansatt') is not null then
    execute 'alter table public.hand_ansatt enable row level security';
    execute 'drop policy if exists "hand_ansatt_select_tenant" on public.hand_ansatt';
    execute 'drop policy if exists "hand_ansatt_insert_tenant" on public.hand_ansatt';
    execute 'drop policy if exists "hand_ansatt_update_tenant" on public.hand_ansatt';
    execute 'drop policy if exists "hand_ansatt_delete_tenant" on public.hand_ansatt';

    execute 'create policy "hand_ansatt_select_tenant" on public.hand_ansatt for select to authenticated using (public.hand_er_sysadmin() or public.hand_har_firma_tilgang(firma_id))';
    execute 'create policy "hand_ansatt_insert_tenant" on public.hand_ansatt for insert to authenticated with check (public.hand_er_firma_admin(firma_id))';
    execute 'create policy "hand_ansatt_update_tenant" on public.hand_ansatt for update to authenticated using (public.hand_er_firma_admin(firma_id)) with check (public.hand_er_firma_admin(firma_id))';
    execute 'create policy "hand_ansatt_delete_tenant" on public.hand_ansatt for delete to authenticated using (public.hand_er_firma_admin(firma_id))';
  end if;

  if to_regclass('public.hand_firma_bruker') is not null then
    execute 'alter table public.hand_firma_bruker enable row level security';
    execute 'drop policy if exists "hand_firma_bruker_select_tenant" on public.hand_firma_bruker';
    execute 'drop policy if exists "hand_firma_bruker_insert_tenant" on public.hand_firma_bruker';
    execute 'drop policy if exists "hand_firma_bruker_update_tenant" on public.hand_firma_bruker';
    execute 'drop policy if exists "hand_firma_bruker_delete_tenant" on public.hand_firma_bruker';

    execute 'create policy "hand_firma_bruker_select_tenant" on public.hand_firma_bruker for select to authenticated using (public.hand_er_sysadmin() or public.hand_har_firma_tilgang(firma_id))';
    execute 'create policy "hand_firma_bruker_insert_tenant" on public.hand_firma_bruker for insert to authenticated with check (public.hand_er_firma_admin(firma_id))';
    execute 'create policy "hand_firma_bruker_update_tenant" on public.hand_firma_bruker for update to authenticated using (public.hand_er_firma_admin(firma_id)) with check (public.hand_er_firma_admin(firma_id))';
    execute 'create policy "hand_firma_bruker_delete_tenant" on public.hand_firma_bruker for delete to authenticated using (public.hand_er_firma_admin(firma_id))';
  end if;

  foreach t in array array[
    'hand_time',
    'hand_faktura',
    'hand_faktura_vare',
    'hand_faktura_utlegg',
    'hand_prosjekt',
    'hand_bil',
    'hand_vare',
    'hand_moduler',
    'hand_kunde_moduler'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    tilgang_expr := null;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'firma_id'
    ) then
      tilgang_expr := 'public.hand_har_firma_tilgang(firma_id)';
    elsif exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'kunde_id'
    ) and exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'kunden_id'
    ) then
      tilgang_expr := 'public.hand_har_kunde_tilgang(coalesce(kunde_id::text, kunden_id::text))';
    elsif exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'kunde_id'
    ) then
      tilgang_expr := 'public.hand_har_kunde_tilgang(kunde_id::text)';
    elsif exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'kunden_id'
    ) then
      tilgang_expr := 'public.hand_har_kunde_tilgang(kunden_id::text)';
    end if;

    if tilgang_expr is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_tenant', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_tenant', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_tenant', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_tenant', t);

    execute format('create policy %I on public.%I for select to authenticated using (public.hand_er_sysadmin() or %s)', t || '_select_tenant', t, tilgang_expr);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.hand_er_sysadmin() or %s)', t || '_insert_tenant', t, tilgang_expr);
    execute format('create policy %I on public.%I for update to authenticated using (public.hand_er_sysadmin() or %s) with check (public.hand_er_sysadmin() or %s)', t || '_update_tenant', t, tilgang_expr, tilgang_expr);
    execute format('create policy %I on public.%I for delete to authenticated using (public.hand_er_sysadmin() or %s)', t || '_delete_tenant', t, tilgang_expr);
  end loop;
end $$;
