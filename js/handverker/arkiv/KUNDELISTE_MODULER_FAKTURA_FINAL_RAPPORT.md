# Kundeliste-fiks for Moduler og Faktura

Rettet at kundevelgere ble tomme for sysadmin.

Endringer:
- Ny fil: `hand-customerlists-final-fix.js`
- `index.html` laster denne med lokal sti: `./hand-customerlists-final-fix.js`
- Felles henting av kunder/firma fra:
  - `hand_firma`
  - `hand_kunde`
  - `hand_kunder`
- Bruker `select('*')` uten `order`, slik at feil/manglende feltnavn ikke stopper hentingen.
- Fyller disse dropdownene:
  - `modulKundeVelger`
  - `fakturaKundeValg`
  - `okonomiKundeValg`
- Kjører etter partials er lastet, ved load, og når man klikker Faktura/Moduler/Admin.

Hvis listen fortsatt er tom etter denne versjonen, er det mest sannsynlig Supabase RLS/select-policy som ikke gir `greknuts@online.no` leseadgang til `hand_firma`/`hand_kunde`.
