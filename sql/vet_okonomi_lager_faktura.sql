-- Veterinær: innpris, fakturert/ikke fakturert og økonomioversikt
-- Kjør i Supabase SQL editor før du bruker ny versjon.

alter table public.vet_varer
add column if not exists innpris numeric default 0;

alter table public.vet_journal
add column if not exists fakturert boolean default false,
add column if not exists fakturanr text,
add column if not exists fakturert_dato date,
add column if not exists fakturert_at timestamptz;

create index if not exists idx_vet_journal_fakturert on public.vet_journal(fakturert);
create index if not exists idx_vet_journal_fakturanr on public.vet_journal(fakturanr);

notify pgrst, 'reload schema';
