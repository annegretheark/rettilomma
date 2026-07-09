# Hovslager – testpakke

Dette er en praktisk testpakke for HovslagerSystemet. Den beste kombinasjonen her er:

- **k6** for belastning/stresstest direkte mot Supabase API-et
- **Playwright** for ekte nettlesertest av innlogging og hovedflyter

> Viktig: Kjør helst mot en egen testbruker/testfirma, ikke produksjonsdata.

## 1. Installer

```bash
npm install
npx playwright install chromium
```

Installer k6 separat:

- macOS: `brew install k6`
- Windows: `winget install k6 --source winget`
- Linux: se k6.io/docs

## 2. Sett miljøvariabler

Kopier `.env.example` til `.env`:

```bash
cp .env.example .env
```

Fyll inn:

```bash
BASE_URL=http://127.0.0.1:4173
SUPABASE_URL=https://pxlbrywowphkczkehmee.supabase.co
SUPABASE_ANON_KEY=sb_publishable_tluvA83iCcKfmgfXetvz5g_farKpCTS
TEST_EMAIL=din-testbruker@example.com
TEST_PASSWORD=ditt-passord
```

## 3. Start appen lokalt

Fra mappen der `index.html` ligger:

```bash
npx serve . -l 4173
```

## 4. Kjør Playwright smoke-test

```bash
npm run test:ui
```

Denne testen sjekker at appen åpner, logger inn, laster dashboard og kan åpne hovedfanene.

## 5. Kjør k6 stresstest

Fra testpakken:

```bash
source .env
npm run test:load
```

Windows PowerShell:

```powershell
$env:SUPABASE_URL="https://pxlbrywowphkczkehmee.supabase.co"
$env:SUPABASE_ANON_KEY="sb_publishable_tluvA83iCcKfmgfXetvz5g_farKpCTS"
$env:TEST_EMAIL="din-testbruker@example.com"
$env:TEST_PASSWORD="ditt-passord"
npm run test:load
```

## Belastningsprofil

k6-testen kjører slik:

1. 1 min oppvarming til 10 brukere
2. 3 min med 25 brukere
3. 3 min med 50 brukere
4. 2 min med 100 brukere
5. 1 min nedtrapping

Du kan endre dette i `k6/supabase-load.js`.

## Hva testen gjør

Hver virtuelle bruker:

1. Logger inn med Supabase Auth
2. Finner `firma_id` fra `hov_profiles`
3. Leser kunder, hester og jobber
4. Oppretter en testkunde
5. Oppretter en testhest
6. Oppretter en testjobb
7. Leser jobbliste igjen

## Suksesskriterier

Standard terskler i k6-filen:

- HTTP-feilrate under 2 %
- 95-persentil responstid under 1,5 sekunder
- Ingen kritiske checks skal feile ofte

## Anbefalt bruk

Start med lav belastning. Når alt fungerer, øk antall brukere gradvis. Ikke kjør maksimal belastning mot produksjon uten at Supabase-plan, database og Storage tåler det.
