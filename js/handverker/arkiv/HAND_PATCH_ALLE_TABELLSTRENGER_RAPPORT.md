# Patch alle tabellstrenger

Denne patchen retter også tabellnavn som ligger i vanlige strenglister, f.eks. backup/test/systemadmin.

## Endrede filer
- `hand-ansatte.js`: {'timer': 1}
- `hand-backup.js`: {'lager_bevegelser': 2, 'faktura_utlegg': 2, 'faktura_varer': 2, 'ansatt_trekk': 2, 'trekk_typer': 2, 'prosjekter': 2, 'fakturaer': 2, 'bil_varer': 2, 'ansatte': 2, 'kunder': 2, 'firma': 2, 'timer': 2, 'varer': 2, 'biler': 2}
- `hand-fravaer.js`: {'fravaer': 2, 'timer': 3}
- `hand-jobber-rolle.js`: {'timer': 1}
- `hand-lonn.js`: {'timer': 1}
- `hand-okonomi.js`: {'faktura_utlegg': 1, 'faktura_varer': 1, 'fakturaer': 1}
- `hand-systemadmin.js`: {'firma': 2}
- `hand-tester.js`: {'ansatt_trekk': 1, 'trekk_typer': 1, 'fakturaer': 1, 'ansatte': 1, 'kunder': 1, 'firma': 1, 'timer': 1}
- `hand-timer.js`: {'timer': 2}

Fjernet filer i `gammelt/`: 28

## Kontroll
Ingen gamle quoted tabellnavn eller gamle `.from(...)`-referanser funnet i JS/HTML.