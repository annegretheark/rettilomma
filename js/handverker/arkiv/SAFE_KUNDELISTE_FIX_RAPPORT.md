# Safe kundeliste-fix

Rettet kundelister uten å endre tema/CSS. Viktigste feil var at flere nyere patcher forsøkte `hand_kunder`, men prosjektets egen tabellmapping bruker `hand_kunde`.

Kundevalg for Moduler, Faktura og Økonomi fylles nå fra `hand_kunde` først, deretter `hand_firma` som fallback.
