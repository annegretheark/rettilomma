# GUI med Auth-epost

GUI-oppretting er justert slik at firma/kunde lagres i `hand_firma`, og appen forsøker å opprette Auth-bruker/sende e-post via Edge Function `opprett-hand-kunde`.

Hvis Auth-brukeren allerede finnes, forsøkes `resetPasswordForEmail` fra klienten.

Merk: Ny Auth-bruker kan ikke opprettes sikkert direkte fra nettleser uten server/Edge Function med service-role.
