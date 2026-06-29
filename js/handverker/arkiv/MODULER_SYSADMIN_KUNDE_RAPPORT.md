# Moduler: kun sysadmin og per aktuell kunde

Endret slik at Moduler ikke skal brukes av vanlig firma-admin.

## Regel
- Greknuts/sysadmin kan åpne Moduler.
- Vanlig admin får stoppmelding og skal ikke se/endre moduler.
- Modulvalg knyttes til valgt kunde/firma via `firma_id`.

## Endrede filer
- `partials/hand-moduler.html` har fått kunde/firma-velger.
- `hand-navigation.js` stopper Moduler for alle som ikke er sysadmin.
- `hand-moduler-sysadmin.js` er lagt til for lasting/lagring av moduler per kunde.
- `index.html` laster `hand-moduler-sysadmin.js`.

## Lagring
Koden prøver først å lagre modulvalg i `hand_firma.moduler`. Hvis den kolonnen ikke finnes, prøver den tabellene `hand_moduler` og `hand_kunde_moduler` med `firma_id`, `modul` og `aktiv`.
