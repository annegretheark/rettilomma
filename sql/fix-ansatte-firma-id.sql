-- PROD FIX: Sett manglende firma_id på ansatte for demo-hand1-firmaet.
-- Kjør denne i Supabase SQL Editor.

update hand_ansatt
set firma_id = 'e60600a7-6174-403a-8213-0fe4a3f30fad'
where firma_id is null
  and lower(coalesce(epost, '')) in (
    'demo-hand@rettilomma.com',
    'annegrethek@hotmail.com',
    'salg@rettilomma.com',
    'support@rettilomma.com',
    'greknuts@online.no'
  );

-- Kontroller:
select id, navn, epost, firma_id, rolle, aktiv
from hand_ansatt
order by navn;
