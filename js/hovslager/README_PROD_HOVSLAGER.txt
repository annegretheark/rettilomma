Hovslager produksjonsfix

Dette er lagt inn:
1. Ny hovslagerkunde i Firma/oppsett har nå felt for midlertidig passord.
2. Knappen "Opprett kunde, Auth-bruker og link" kaller Supabase Edge Function: opprett-hov-kunde.
3. Edge Function oppretter/oppdaterer bruker i Supabase Authentication og lagrer/oppdaterer hov_firma.
4. "Send passordoppretting" sender reset-epost til kunden.
5. reset.html ligger på root og lar kunden sette nytt passord.

Må gjøres i Supabase før knappen virker:
- Deploy supabase/functions/opprett-hov-kunde
- Legg inn secrets:
  APP_SUPABASE_URL
  APP_SERVICE_ROLE_KEY

Lokale redirect URLs i Supabase Auth:
- http://localhost/rettilomma/reset.html
- http://localhost/rettilomma/hovslager/

Produksjon redirect URLs:
- https://rettilomma.com/reset.html
- https://rettilomma.com/hovslager/
- eventuelt Vercel-urlene dine
