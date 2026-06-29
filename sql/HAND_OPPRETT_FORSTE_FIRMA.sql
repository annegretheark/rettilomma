-- HAND: opprett første firma manuelt hvis Firma-siden ikke får gjort det
-- Kjør bare hvis hand_firma er tom eller innlogget bruker mangler firma.
-- Endre verdiene før du kjører.

insert into public.hand_firma (
  navn,
  adresse,
  epost,
  orgnr,
  mva_nr,
  kontonr,
  vipps_nummer,
  vipps_mottaker,
  brevhode_tekst,
  brevfot_tekst
)
values (
  'Mitt firma',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  ''
)
returning *;

-- Etterpå kan du koble en ansatt til firmaet slik:
-- update public.hand_ansatt
-- set firma_id = '<ID_FRA_HAND_FIRMA>'
-- where lower(epost) = lower('<DIN_EPOST>');
