# Admin firma-filter

Endret slik at vanlig firma-admin ikke lenger ser alle data på tvers av firma.

## Regel
- Sysadmin (`greknuts@online.no` / `window.erSystemadmin === true`) kan se alle firma, brukere og jobber.
- Vanlig admin (`window.erAdmin === true`, men ikke sysadmin) filtreres på egen `firma_id`.
- Vanlig bruker ser bare egne jobber/timer.

## Endrede filer
- `hand-jobber-rolle.js`
- `hand-timer.js`
- `hand-ansatte.js`
- `partials/hand-jobber.html`

## Viktig
Dette forutsetter at radene i `hand_ansatt` og `hand_time` har korrekt `firma_id`. Hvis gamle rader mangler `firma_id`, vil firma-admin ikke se dem før firma_id er fylt inn.
