# Sysadmin kundefaktura fix

Endret slik at sysadmin/greknuts ikke bruker vanlig Faktura-knapp som egen bruker.

## Endringer

- Skjuler `visFakturaKnapp` for sysadmin.
- Vanlig firma-admin beholder vanlig Faktura-knapp for eget firma.
- Sysadmin får faktura via valgt kunde/firma i systemadmin-kundelisten.
- Lagt inn `handFakturaForKunde(kundeId)` som åpner fakturasiden med valgt kunde.
- Lagt inn knapp `Faktura til kunde` per kunde/firma i sysadmin-listen.

## Viktig

Sysadmin skal først velge kunde/firma i Systemadministrasjon. Fakturaen blir da knyttet til denne kunden.
