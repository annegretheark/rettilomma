# Faktura kundeliste sysadmin fix

Rettet at kundevelgeren på Faktura-siden kunne bli tom for sysadmin.

Endring:
- Ny fil: `hand-faktura-kundeliste-sysadm-fix.js`
- Laster kunder/firma adaptivt fra `hand_firma` og `hand_kunder`.
- Bruker `handAdminKunder` hvis systemadmin-listen allerede er lastet.
- Overstyrer `fyllFakturaKundeDropdown()` for sysadmin slik at vanlig tom `window.kunder` ikke tømmer listen.
- Viser melding dersom Supabase/RLS ikke returnerer firma.
