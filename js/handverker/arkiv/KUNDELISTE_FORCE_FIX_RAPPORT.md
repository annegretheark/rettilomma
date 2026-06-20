# Kundeliste force fix

Rettet tom kundeliste i Moduler/Faktura ved å legge inn `hand-kundeliste-force-fix.js`.

Denne gjør følgende:

- henter kunder/firma fra `hand_firma`, `hand_kunde`, `hand_kunder` og `hand_ansatt`
- setter `window.kunder`, `window.handAdminKunder` og `window.firmaer`
- overstyrer gamle funksjoner som tømte dropdowns fra tom `window.kunder`
- fyller `modulKundeVelger`, `fakturaKundeValg`, `okonomiKundeValg` og `kundeValg`
- viser synlig status hvis Supabase/RLS blokkerer lesing

Hvis status fortsatt viser 0 rader/FEIL, må RLS i Supabase gi Greknuts/sysadmin SELECT på `hand_firma` eller minst `hand_ansatt`.
