
async function tomAlleDemodata() {

  if (!confirm("Tømme alle demodata? Firma og ansatte beholdes.")) {
    return;
  }

  try {

    testLogg("Starter tømming av demodata...", true);

    const tabeller = [
      "faktura_utlegg",
      "faktura_varer",
      "fakturaer",
      "timer",
      "prosjekter",
      "lager_bevegelser",
      "bil_varer",
      "varer",
      "biler",
      "kunder"
    ];

    for (const tabell of tabeller) {

      const { error } = await supabaseClient
        .from(tabell)
        .delete()
        .not("id", "is", null);

      if (error) {
        testLogg("FEIL i " + tabell + ": " + error.message);
      } else {
        testLogg("Tømte " + tabell, true);
      }
    }

    if (typeof lastTimer === "function") await lastTimer();
    if (typeof lastKunder === "function") await lastKunder();

    testLogg("Alle demodata er slettet.", true);

  } catch (err) {
    testLogg("TØMMING FEIL: " + err.message);
  }
}

window.tomAlleDemodata = tomAlleDemodata;
