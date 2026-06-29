-- Rett i Lomma 7076 - eier/admin-modell for faktisk produksjonsstruktur
-- Kjør i Supabase SQL Editor.
-- Produksjonstabeller fra skjermbildene:
--   firma_brukere = eiere / hovedbrukere for firma
--   ansatte       = ansatte i firma, admin kan få rettigheter
-- Gamle hand_firma_bruker / hand_ansatt støttes også hvis de finnes.

create or replace function public.hand_kan_admin_firma(p_firma_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_email text := lower(coalesce(auth.email(), ''));
  v_ok boolean := false;
  v_tbl text;
begin
  if coalesce(p_firma_id, '') = '' then
    return false;
  end if;

  -- Firmaeier / hovedbruker. I din database heter tabellen firma_brukere.
  foreach v_tbl in array array['firma_brukere','hand_firma_bruker'] loop
    if to_regclass('public.' || v_tbl) is not null then
      execute format($q$
        select exists (
          select 1
          from public.%I r
          where coalesce(to_jsonb(r)->>'firma_id','') = $1
            and (
              coalesce(to_jsonb(r)->>'bruker_id','') = $2
              or coalesce(to_jsonb(r)->>'user_id','') = $2
              or coalesce(to_jsonb(r)->>'auth_id','') = $2
              or coalesce(to_jsonb(r)->>'auth_user_id','') = $2
              or lower(coalesce(to_jsonb(r)->>'epost', to_jsonb(r)->>'email', to_jsonb(r)->>'bruker_epost', to_jsonb(r)->>'user_email', '')) = $3
            )
            and (
              lower(coalesce(to_jsonb(r)->>'rolle', to_jsonb(r)->>'role', '')) in ('eier','owner','firmaeier','hovedbruker','admin','administrator')
              or lower(coalesce(to_jsonb(r)->>'eier','')) in ('true','1','ja')
              or lower(coalesce(to_jsonb(r)->>'owner','')) in ('true','1','ja')
              or lower(coalesce(to_jsonb(r)->>'er_eier','')) in ('true','1','ja')
              or lower(coalesce(to_jsonb(r)->>'admin','')) in ('true','1','ja')
              or lower(coalesce(to_jsonb(r)->>'er_admin','')) in ('true','1','ja')
            )
        )
      $q$, v_tbl) into v_ok using p_firma_id, v_uid, v_email;
      if coalesce(v_ok,false) then return true; end if;
    end if;
  end loop;

  -- Ansatt-admin. Vanlig ansatt/bruker skal ikke kunne importere/endre varer.
  foreach v_tbl in array array['ansatte','hand_ansatt'] loop
    if to_regclass('public.' || v_tbl) is not null then
      execute format($q$
        select exists (
          select 1
          from public.%I r
          where coalesce(to_jsonb(r)->>'firma_id','') = $1
            and (
              coalesce(to_jsonb(r)->>'bruker_id','') = $2
              or coalesce(to_jsonb(r)->>'user_id','') = $2
              or coalesce(to_jsonb(r)->>'auth_id','') = $2
              or coalesce(to_jsonb(r)->>'auth_user_id','') = $2
              or lower(coalesce(to_jsonb(r)->>'epost', to_jsonb(r)->>'email', '')) = $3
            )
            and (
              lower(coalesce(to_jsonb(r)->>'rolle', to_jsonb(r)->>'role', '')) in ('admin','administrator','eier','owner','firmaeier')
              or lower(coalesce(to_jsonb(r)->>'admin','')) in ('true','1','ja')
              or lower(coalesce(to_jsonb(r)->>'er_admin','')) in ('true','1','ja')
            )
        )
      $q$, v_tbl) into v_ok using p_firma_id, v_uid, v_email;
      if coalesce(v_ok,false) then return true; end if;
    end if;
  end loop;

  return false;
end;
$$;

-- Lesing: alle som er koblet til firma kan se varer. Endring/import: kun eier/admin.
create or replace function public.hand_har_firma_tilgang(p_firma_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid text := auth.uid()::text;
  v_email text := lower(coalesce(auth.email(), ''));
  v_ok boolean := false;
  v_tbl text;
begin
  if coalesce(p_firma_id, '') = '' then
    return false;
  end if;

  foreach v_tbl in array array['firma_brukere','hand_firma_bruker','ansatte','hand_ansatt'] loop
    if to_regclass('public.' || v_tbl) is not null then
      execute format($q$
        select exists (
          select 1
          from public.%I r
          where coalesce(to_jsonb(r)->>'firma_id','') = $1
            and (
              coalesce(to_jsonb(r)->>'bruker_id','') = $2
              or coalesce(to_jsonb(r)->>'user_id','') = $2
              or coalesce(to_jsonb(r)->>'auth_id','') = $2
              or coalesce(to_jsonb(r)->>'auth_user_id','') = $2
              or lower(coalesce(to_jsonb(r)->>'epost', to_jsonb(r)->>'email', to_jsonb(r)->>'bruker_epost', to_jsonb(r)->>'user_email', '')) = $3
            )
        )
      $q$, v_tbl) into v_ok using p_firma_id, v_uid, v_email;
      if coalesce(v_ok,false) then return true; end if;
    end if;
  end loop;

  return false;
end;
$$;

drop policy if exists hand_vare_select_firma_7075 on public.hand_vare;
drop policy if exists hand_vare_insert_admin_7075 on public.hand_vare;
drop policy if exists hand_vare_update_admin_7075 on public.hand_vare;
drop policy if exists hand_vare_delete_admin_7075 on public.hand_vare;
drop policy if exists hand_vare_select_firma_7076 on public.hand_vare;
drop policy if exists hand_vare_insert_admin_7076 on public.hand_vare;
drop policy if exists hand_vare_update_admin_7076 on public.hand_vare;
drop policy if exists hand_vare_delete_admin_7076 on public.hand_vare;

create policy hand_vare_select_firma_7076
on public.hand_vare for select
to authenticated
using (public.hand_har_firma_tilgang(firma_id::text) or public.hand_kan_admin_firma(firma_id::text));

create policy hand_vare_insert_admin_7076
on public.hand_vare for insert
to authenticated
with check (public.hand_kan_admin_firma(firma_id::text));

create policy hand_vare_update_admin_7076
on public.hand_vare for update
to authenticated
using (public.hand_kan_admin_firma(firma_id::text))
with check (public.hand_kan_admin_firma(firma_id::text));

create policy hand_vare_delete_admin_7076
on public.hand_vare for delete
to authenticated
using (public.hand_kan_admin_firma(firma_id::text));
