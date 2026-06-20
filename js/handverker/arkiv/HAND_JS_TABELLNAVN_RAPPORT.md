# Hand JS-tabellnavn rapport

JavaScript/HTML er oppdatert til nye `hand_`-tabellnavn før Supabase-tabellene endres.

## Endrede filer
- hand-admin-timer-ansatt.js
- hand-ansatte.js
- hand-app.js
- hand-auth.js
- hand-bil-bestillinger.js
- hand-biler.js
- hand-faktura.js
- hand-faktura-data.js
- hand-faktura-pdf.js
- hand-faktura-valg.js
- hand-firma.js
- hand-fravaer.js
- hand-jobber-rolle.js
- hand-kunder.js
- hand-lager-patch.js
- hand-lonn.js
- hand-okonomi.js
- hand-prosjekter.js
- hand-systemadmin.js
- hand-tester.js
- hand-timer.js
- hand-varer.js
- gammelt/admin-timer-ansatt.js
- gammelt/ansatte.js
- gammelt/app.js
- gammelt/auth.js
- gammelt/bil-bestillinger.js
- gammelt/biler.js
- gammelt/faktura.js
- gammelt/fakturaData.js
- gammelt/fakturaPdf.js
- gammelt/fakturaValg.js
- gammelt/firma.js
- gammelt/fravaer.js
- gammelt/jobber-rolle.js
- gammelt/kunder.js
- gammelt/lager-patch.js
- gammelt/lonn.js
- gammelt/okonomi.js
- gammelt/prosjekter.js
- gammelt/tester.js
- gammelt/timer.js
- gammelt/varer.js

## Tabellmapping
- `ansatte` -> `hand_ansatt`
- `ansatt_trekk` -> `hand_ansatt_trekk`
- `trekk_typer` -> `hand_trekk_type`
- `firma` -> `hand_firma`
- `firma_brukere` -> `hand_firma_bruker`
- `kunder` -> `hand_kunde`
- `prosjekter` -> `hand_prosjekt`
- `timer` -> `hand_time`
- `timer_bilder` -> `hand_time_bilde`
- `fakturaer` -> `hand_faktura`
- `faktura_varer` -> `hand_faktura_vare`
- `faktura_utlegg` -> `hand_faktura_utlegg`
- `varer` -> `hand_vare`
- `biler` -> `hand_bil`
- `bil_lager` -> `hand_bil_lager`
- `bil_varer` -> `hand_bil_vare`
- `bil_bestillinger` -> `hand_bil_bestilling`
- `fravaer` -> `hand_fravaer`
- `timebank` -> `hand_timebank`
- `lonnskjoring` -> `hand_lonnskjoring`
- `lager_bestillinger` -> `hand_lager_bestilling`
- `lager_bevegelser` -> `hand_lager_bevegelse`
- `lagerlogg` -> `hand_lagerlogg`
- `innkjopsvarsler` -> `hand_innkjopsvarsel`

## Kontroll
Ingen gamle Supabase `.from("...")`-referanser til Hand-tabeller ble funnet etter endring.

## SQL
Kjør `HAND_MIGRERING_TABELLNAVN.sql` i Supabase først etter at denne koden er lagt ut.