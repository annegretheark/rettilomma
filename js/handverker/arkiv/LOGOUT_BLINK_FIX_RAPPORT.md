# Logout og blinking fikset

Endringer:

- La inn `loggUtKnapp` i `partials/hand-topbar.html`.
- `startApp()` venter nå på `window.handPartialerKlare` før appvisning/rollevisning starter.
- Dette hindrer blinking/flicker som kan oppstå når appen vises før partials er ferdig lastet.
- La inn trygg ny kobling av knapper etter `handPartialerLastet`, slik at logout og menyknapper finnes før event listeners settes.
- Oppdaterte cache-versjon i `index.html` slik at nettleseren ikke bruker gammel fil.

Test etter opplasting:

1. Hard refresh / tøm cache.
2. Logg inn som greknuts.
3. Se at bildet/siden ikke blunker.
4. Kontroller at `Logg ut` vises øverst til høyre.
5. Trykk `Logg ut` og kontroller at login-siden vises.
