-- PROD: Lagerbestilling for Håndverker
-- Kjør i Supabase SQL Editor før du bruker ny lagerflyt.

create table if not exists hand_lager_bestilling (
  id uuid primary key default gen_random_uuid(),
  firma_id uuid not null references hand_firma(id) on delete cascade,
  bil_id uuid null references hand_bil(id) on delete set null,
  bil_navn text null,
  vare_id uuid not null references hand_vare(id) on delete cascade,
  varenr text null,
  varenavn text null,

  antall_bestilt numeric not null default 0,
  antall_levert numeric not null default 0,
  minimum_bil numeric not null default 0,
  hovedlager_ved_bestilling numeric not null default 0,

  bestilt_av_user_id uuid not null,
  bestilt_av_epost text null,
  bestilt_av_navn text null,

  levert_av_user_id uuid null,
  levert_at timestamptz null,

  status text not null default 'ny',
  kommentar text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table hand_lager_bestilling enable row level security;

drop policy if exists hand_lager_bestilling_select on hand_lager_bestilling;
drop policy if exists hand_lager_bestilling_insert on hand_lager_bestilling;
drop policy if exists hand_lager_bestilling_update_admin on hand_lager_bestilling;

create policy hand_lager_bestilling_select
on hand_lager_bestilling
for select
to authenticated
using (
  (
    bestilt_av_user_id = auth.uid()
    and exists (
      select 1
      from hand_firma_bruker fb
      where fb.user_id = auth.uid()
        and fb.firma_id = hand_lager_bestilling.firma_id
    )
  )
  or
  exists (
    select 1
    from hand_firma_bruker fb
    where fb.user_id = auth.uid()
      and fb.firma_id = hand_lager_bestilling.firma_id
      and lower(coalesce(fb.rolle, '')) in ('admin', 'eier')
  )
);

create policy hand_lager_bestilling_insert
on hand_lager_bestilling
for insert
to authenticated
with check (
  bestilt_av_user_id = auth.uid()
  and exists (
    select 1
    from hand_firma_bruker fb
    where fb.user_id = auth.uid()
      and fb.firma_id = hand_lager_bestilling.firma_id
  )
);

create policy hand_lager_bestilling_update_admin
on hand_lager_bestilling
for update
to authenticated
using (
  exists (
    select 1
    from hand_firma_bruker fb
    where fb.user_id = auth.uid()
      and fb.firma_id = hand_lager_bestilling.firma_id
      and lower(coalesce(fb.rolle, '')) in ('admin', 'eier')
  )
)
with check (
  exists (
    select 1
    from hand_firma_bruker fb
    where fb.user_id = auth.uid()
      and fb.firma_id = hand_lager_bestilling.firma_id
      and lower(coalesce(fb.rolle, '')) in ('admin', 'eier')
  )
);

create index if not exists idx_hand_lager_bestilling_firma_status
on hand_lager_bestilling(firma_id, status);

create index if not exists idx_hand_lager_bestilling_bruker
on hand_lager_bestilling(bestilt_av_user_id, created_at desc);

create index if not exists idx_hand_lager_bestilling_bil
on hand_lager_bestilling(bil_id, created_at desc);
