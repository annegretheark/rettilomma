-- Rett i Lomma - modulstyring
-- Kjør denne i Supabase SQL Editor.

create table if not exists public.moduler (
  navn text primary key,
  aktiv boolean not null default false,
  oppdatert_at timestamptz not null default now()
);

insert into public.moduler (navn, aktiv) values
  ('ansatte', true),
  ('varer', false),
  ('biler', false),
  ('lager', false),
  ('prosjekter', false),
  ('purring', true),
  ('lonn', false),
  ('bilder', true),
  ('testpanel', false)
on conflict (navn) do nothing;

create or replace function public.sett_oppdatert_at_moduler()
returns trigger as $$
begin
  new.oppdatert_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_moduler_oppdatert_at on public.moduler;
create trigger trg_moduler_oppdatert_at
before update on public.moduler
for each row
execute function public.sett_oppdatert_at_moduler();

-- Hvis RLS er på i prosjektet ditt senere, kan du lage egne policies her.
-- Foreløpig følger dette samme mønster som resten av appen din.
