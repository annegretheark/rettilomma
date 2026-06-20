# Hand navnestandard

Mål: Alle filer og tabeller som hører til Hand skal være enkle å kjenne igjen.

## Prefiks

Bruk `hand_` på nye tabeller og nye filer.

## Nye tabeller for tilbud

- `hand_tilbud`
- `hand_tilbud_linje`
- `hand_tilbud_vedlegg` (klar for senere bruk)

## Anbefalt framtidig navnestandard for eksisterende tabeller

Disse bør ikke byttes midt i koden uten migrering og testing, fordi eksisterende JavaScript allerede bruker gamle navn.

| Gammelt navn | Anbefalt nytt navn |
|---|---|
| firma | hand_firma |
| kunder | hand_kunde |
| prosjekter | hand_prosjekt |
| ansatte | hand_ansatt |
| timer | hand_time |
| timer_bilder | hand_time_bilde |
| fakturaer | hand_faktura |
| faktura_varer | hand_faktura_vare |
| faktura_utlegg | hand_faktura_utlegg |
| varer | hand_vare |
| biler | hand_bil |
| bil_lager | hand_bil_lager |
| fravaer | hand_fravaer |
| timebank | hand_timebank |
| lonnskjoring | hand_lonnskjoring |
| ansatt_trekk | hand_ansatt_trekk |

## Anbefalt filnavn videre

Nye Hand-filer bør hete `hand-...js`, for eksempel:

- `hand-tilbud.js`
- `hand-firma.js`
- `hand-kunder.js`
- `hand-prosjekter.js`
- `hand-timer.js`
- `hand-faktura.js`

## Viktig

Jeg har ikke masseendret alle eksisterende tabellnavn i koden, fordi det kan ødelegge appen hvis databasen fortsatt heter `kunder`, `timer`, `fakturaer` osv. Denne pakken legger inn ny tilbudsmodul med riktig prefiks og gir SQL for nye tabeller.
