# Kundelink automatisk

Endret slik at kundelink opprettes automatisk fra firmanavn.

## Regler
- Sysadmin skriver firmanavn.
- `linknavn` fylles automatisk fra firmanavn, f.eks. `Hansen Bygg AS` -> `hansen-bygg-as`.
- Kundelink blir automatisk: `/handverker/?firma=hansen-bygg-as`.
- Lenken lagres på firma/kunde som `linknavn`, og forsøkes også lagret som `kundelink` og `kunde_link` hvis kolonnene finnes.
- Ved redigering blir linknavn oppdatert fra firmanavn.
- `linknavn`-feltet er readonly for å unngå feilskriving.

## Åpning via kundelink
Appen leser nå `?firma=...` fra URL og prøver å finne riktig `hand_firma` via `linknavn`.
Dette gjør at kundelinken peker på aktuell kunde/firma.

## Endrede filer
- `hand-systemadmin.js`
- `hand-firma.js`
- `partials/hand-systemadmin.html`
