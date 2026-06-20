# Final sysadmin/firma fix

Rettet i denne ZIP-en:

1. `greknuts@online.no` tvinges til `sysadmin`, `sysadm` og `adminmodus` etter innlogging og ved UI-oppdateringer.
2. Greknuts forsøkes oppdatert/opprettet i `hand_ansatt` med `rolle = sysadmin`, slik at RLS/policyer som sjekker `hand_ansatt` får riktig rolle.
3. Systemadministrasjon-knappen kobles på nytt etter at partials er lastet.
4. Kundeliste/firma hentes robust fra `hand_firma`, med fallback til `hand_kunder`.
5. Hvis firma fortsatt ikke vises, viser appen tydelig melding om at Supabase RLS/select-policy blokkerer `hand_firma`.
6. Filen `hand-final-sysadm-firma-fix.js` er også lagt ved, og samme patch er lagt til nederst i `hand-inline-fixes.js` for å sikre at den kjøres.

Viktig: Ny kunde kan få firma-rad og adminrad fra frontend, men selve Supabase Auth-brukeren må opprettes av Edge Function `opprett-hand-kunde` eller Supabase invite. `resetPasswordForEmail` oppretter ikke ny Auth-bruker alene.
