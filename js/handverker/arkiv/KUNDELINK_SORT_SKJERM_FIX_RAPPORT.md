# Kundelink sort skjerm - fix

Problem:
- Når kundelink ble åpnet uten aktiv Supabase-session, viste appen login kort et øyeblikk.
- Etterpå skjulte `hand-inline-fixes.js` login-siden basert på gammel e-post i `localStorage`.
- Resultatet ble at både login og app var skjult: sort skjerm.

Endring:
- `hand-inline-fixes.js` bruker ikke lenger gammel `handInnloggetEpost` fra localStorage som bevis på innlogging.
- Login-siden skjules bare når `window.innloggetEpost` faktisk er satt av aktiv session.
- `hand-app.js` viser en enkel melding på login-siden når URL har `?firma=...`.

Forventet flyt:
- Åpne kundelink uten innlogging: login-siden vises stabilt med melding.
- Logg inn: appen åpner riktig uten sort skjerm.
- Greknuts/sysadmin-reglene påvirkes ikke når hun faktisk er innlogget.
