-- Fiks for behandlingstype/prisliste etter kundesikkerhet.
-- Kjor denne hvis vanlig behandler ikke far valgt behandlingstype.
--
-- Denne apner bare lesing av beh_priser for innloggede brukere.
-- Kunder, dyr, behandlinger og fakturaer er fortsatt sperret per behandler.

alter table public.beh_priser enable row level security;

drop policy if exists beh_priser_select_authenticated on public.beh_priser;

create policy beh_priser_select_authenticated
on public.beh_priser
for select
to authenticated
using (true);
