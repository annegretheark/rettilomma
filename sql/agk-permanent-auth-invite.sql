-- Permanent grunnmur for bedrift_nokkel.
-- Kjor denne i Supabase SQL Editor for a fylle manglende nokler og stoppe nye NULL-verdier.

update hand_firma
set bedrift_nokkel = 'HF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
where bedrift_nokkel is null;

alter table hand_firma
alter column bedrift_nokkel set default ('HF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));

-- Ikke sett NOT NULL for hardt hvis du har gamle/importerte data som ma ryddes forst.
-- Nar alt er testet kan du eventuelt kjore:
-- alter table hand_firma alter column bedrift_nokkel set not null;

select id, navn, epost, linknavn, bedrift_nokkel
from hand_firma
order by created_at desc
limit 20;
