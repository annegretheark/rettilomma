# Sysadmin-fiks for Håndverker

Endret disse filene:
- hand-app.js
- hand-inline-fixes.js
- hand-navigation.js

Problem funnet:
- `greknuts@online.no` fikk sysadmin i `hand-auth.js`, men senere kunne `hand-app.js` og `hand-inline-fixes.js` overskrive `window.erSystemadmin` basert bare på rollen i `hand_ansatt`.
- Hvis Greknuts ikke har `rolle = systemadmin/sysadmin` i `hand_ansatt`, kunne sysadmin-funksjonen forsvinne.
- Navigasjonen krevde både `window.erSystemadmin === true` og `rilSysadminModus === ja`, så en kort overskriving kunne skjule sysadmin-panelet.

Ny regel:
- `greknuts@online.no` har alltid rettighet til admin og systemadmin.
- Vanlig/admin/sysadmin-visning styres fortsatt med `rilAdminModus` og `rilSysadminModus`.
- Kunder som opprettes får fortsatt `rolle: 'admin'` og `er_admin: true`, altså admin over eget firma.
