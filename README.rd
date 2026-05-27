# rettilomma

Samlet repo for Rett i Lomma.

## Innhold

- `index.html` = hovedsystem for håndverker/konsulent/timeregistrering.
- `hovslager.html` = hovslagerdelen lagt inn i samme repo, men holdt separat foreløpig for trygg overgang.
- `js/core/moduler.js` = modulstyring for hovedsystemet.
- `js/hovslager/` = alle hovslagerfilene fra det gamle repoet.
- `sql/` = SQL-script fra håndverkerdelen.

## Viktig

Det gamle hovslager-repoet bør beholdes som backup/demo en stund.
Dette nye repoet er laget for sammenslåing uten å slette noe gammelt.

## Anbefalt Git-oppsett

```bash
git init
git add .
git commit -m "Samle håndverker og hovslager i rettilomma"
git branch -M main
git remote add origin <URL TIL NYTT GITHUB-REPO>
git push -u origin main
```

## Neste ryddesteg

1. Test `index.html`.
2. Test `hovslager.html`.
3. Når begge virker, kan hovslagerfunksjonene gradvis kobles tettere inn i modulstyringen.
