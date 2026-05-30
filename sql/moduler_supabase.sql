-- Moduloppsett per kunde i Supabase
-- Kjør i Supabase SQL Editor

alter table firma
add column if not exists moduler jsonb default '{}'::jsonb;

alter table firma
add column if not exists moduler_konfigurert boolean default false;

-- Valgfritt: sett eksisterende kunder som ikke konfigurert slik at veiviser vises én gang
update firma
set moduler_konfigurert = false
where moduler_konfigurert is null;
