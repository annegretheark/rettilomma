-- Rett i Lomma 7075 - tydelig eier/admin-modell for firma og varer
-- Kjør denne i Supabase SQL Editor hvis import fortsatt stoppes av RLS.
-- Modell:
--   hand_firma_bruker = firmaeier/hovedkonto
--   hand_ansatt = ansatte med tildelte rettigheter
--   ansatt-admin kan administrere varer for sitt firma uten å være firmaeier.
-- SQL-en bruker to_jsonb slik at den tåler at enkelte valgfrie kolonner ikke finnes.

create or replace function public.hand_kan_admin_firma(p_firma_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.hand_firma_bruker fb
    where fb.firma_id::text = p_firma_id
      and (
        coalesce(to_jsonb(fb)->>'user_id','') = auth.uid()::text
        or coalesce(to_jsonb(fb)->>'auth_id','') = auth.uid()::text
        or coalesce(to_jsonb(fb)->>'auth_user_id','') = auth.uid()::text
        or coalesce(to_jsonb(fb)->>'bruker_id','') = auth.uid()::text
        or lower(coalesce(to_jsonb(fb)->>'epost', to_jsonb(fb)->>'email', to_jsonb(fb)->>'bruker_epost', to_jsonb(fb)->>'user_email', '')) = lower(coalesce(auth.email(), ''))
      )
      and (
        lower(coalesce(to_jsonb(fb)->>'eier','')) in ('true','1','ja')
        or lower(coalesce(to_jsonb(fb)->>'owner','')) in ('true','1','ja')
        or lower(coalesce(to_jsonb(fb)->>'er_eier','')) in ('true','1','ja')
        or lower(coalesce(to_jsonb(fb)->>'admin','')) in ('true','1','ja')
        or lower(coalesce(to_jsonb(fb)->>'er_admin','')) in ('true','1','ja')
        or lower(coalesce(to_jsonb(fb)->>'rolle', to_jsonb(fb)->>'role', '')) in ('eier','owner','firmaeier','admin','administrator')
      )
  )
  or exists (
    select 1
    from public.hand_ansatt a
    where a.firma_id::text = p_firma_id
      and (
        coalesce(to_jsonb(a)->>'user_id','') = auth.uid()::text
        or coalesce(to_jsonb(a)->>'auth_id','') = auth.uid()::text
        or coalesce(to_jsonb(a)->>'auth_user_id','') = auth.uid()::text
        or lower(coalesce(to_jsonb(a)->>'epost', to_jsonb(a)->>'email', '')) = lower(coalesce(auth.email(), ''))
      )
      and (
        lower(coalesce(to_jsonb(a)->>'admin','')) in ('true','1','ja')
        or lower(coalesce(to_jsonb(a)->>'er_admin','')) in ('true','1','ja')
        or lower(coalesce(to_jsonb(a)->>'rolle', '')) in ('admin','administrator','eier','owner')
      )
  );
$$;

drop policy if exists hand_vare_select_firma_7075 on public.hand_vare;
drop policy if exists hand_vare_insert_admin_7075 on public.hand_vare;
drop policy if exists hand_vare_update_admin_7075 on public.hand_vare;
drop policy if exists hand_vare_delete_admin_7075 on public.hand_vare;

create policy hand_vare_select_firma_7075
on public.hand_vare for select
to authenticated
using (public.hand_kan_admin_firma(firma_id::text));

create policy hand_vare_insert_admin_7075
on public.hand_vare for insert
to authenticated
with check (public.hand_kan_admin_firma(firma_id::text));

create policy hand_vare_update_admin_7075
on public.hand_vare for update
to authenticated
using (public.hand_kan_admin_firma(firma_id::text))
with check (public.hand_kan_admin_firma(firma_id::text));

create policy hand_vare_delete_admin_7075
on public.hand_vare for delete
to authenticated
using (public.hand_kan_admin_firma(firma_id::text));
