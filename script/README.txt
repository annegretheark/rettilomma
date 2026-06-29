Hovslager JSON-gjenoppretting v5

Denne versjonen fikser feilen der hov_firma.id i backupen er tallet 1, mens databasen forventer UUID.

1. Pakk ut ZIP-en.
2. Kjor for test:
   node restore-fra-json-v5.mjs --dry-run --verbose

3. Kjor faktisk gjenoppretting:
   node restore-fra-json-v5.mjs --verbose

Eller dobbeltklikk kjor-gjenoppretting.bat.

Hvis Supabase blokkerer skriving, bruk innlogging:
set HOV_EMAIL=din_epost
set HOV_PASSWORD=ditt_passord
node restore-fra-json-v5.mjs --verbose
