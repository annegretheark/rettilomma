# Hovslager som modul

Disse filene er oppdatert slik at hovslager åpnes som modul fra hovedappen:

- `index.html`
- `js/navigation.js`
- `js/app.js`
- `hovslager.html`

## Hva er endret

- Hovslager-knappen sjekker at modulen er aktiv før siden åpnes.
- Hovslager bruker felles Supabase-config fra `js/core/config.js`.
- Hovslager-siden har knapp tilbake til hovedappen.
- Koden holder hovslager som egen modulside, men styrt fra modulvalget i Rett i Lomma.

## Slik legger du inn

Kopier filene inn i prosjektet og overskriv gamle filer.

Test:

1. Logg inn som admin.
2. Gå til Moduler.
3. Velg Hovslager eller Pro.
4. Lagre.
5. Trykk Hovslager-knappen.

Hvis modulen er slått av, skal knappen skjules. Hvis den likevel trykkes, får du melding om at modulen ikke er aktiv.
