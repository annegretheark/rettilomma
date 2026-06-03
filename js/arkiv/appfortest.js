console.log("NY app.js er lastet");

function koble(id, event, funksjon) {
  const element = document.getElementById(id);

  if (!element) {
    console.warn("Fant ikke element:", id);
    return;
  }

  if (typeof funksjon !== "function") {
    console.warn("Fant ikke funksjon for:", id);
    return;
  }

  element.addEventListener(event, funksjon);
}

function tryggFunksjon(navn) {
  return typeof window[navn] === "function" ? window[navn] : undefined;
}

koble("loginKnapp", "click", tryggFunksjon("loggInn"));
koble("glemtPassordKnapp", "click", tryggFunksjon("glemtPassord"));
koble("lagreNyttPassordKnapp", "click", tryggFunksjon("lagreNyttPassord"));
koble("tilbakeTilLoginKnapp", "click", tryggFunksjon("visLogin"));
koble("loggUtKnapp", "click", tryggFunksjon("loggUt"));

koble("visTimerKnapp", "click", tryggFunksjon("visTimerSide"));
koble("visKundeKnapp", "click", tryggFunksjon("visKundeSide"));
koble("visAnsattKnapp", "click", tryggFunksjon("visAnsattSide"));
koble("visFirmaKnapp", "click", tryggFunksjon("visFirmaSide"));

koble("leggTilKundeKnapp", "click", tryggFunksjon("lagreKunde"));
koble("tilbakeTilTimerKnapp", "click", tryggFunksjon("visTimerSide"));

koble("leggTilTrekkKnapp", "click", tryggFunksjon("leggTilTrekk"));
koble("lagreAnsattKnapp", "click", tryggFunksjon("lagreAnsatt"));
koble("tilbakeFraAnsattKnapp", "click", tryggFunksjon("visTimerSide"));

koble("lagreFirmaKnapp", "click", tryggFunksjon("lagreFirma"));
koble("firmaLogo", "change", tryggFunksjon("lastInnLogo"));
koble("tilbakeFraFirmaKnapp", "click", tryggFunksjon("visTimerSide"));

koble("lagreTimerKnapp", "click", tryggFunksjon("lagreTimer"));
koble("excelKnapp", "click", tryggFunksjon("eksporterMvaRegneark"));
koble("pdfKnapp", "click", tryggFunksjon("lagFakturaPdf"));
koble("backupKnapp", "click", tryggFunksjon("backup"));

const importFil = document.getElementById("importFil");
if (importFil && typeof window.importerBackup === "function") {
  importFil.addEventListener("change", window.importerBackup);
}

const kundeValg = document.getElementById("kundeValg");
if (kundeValg && typeof window.visKundeNavn === "function") {
  kundeValg.addEventListener("change", window.visKundeNavn);
}

const startTidFelt = document.getElementById("startTid");
if (startTidFelt) {
  startTidFelt.addEventListener("change", () => {
    const sluttTid = document.getElementById("sluttTid");
    if (sluttTid) sluttTid.focus();
  });
}

if (typeof supabaseClient !== "undefined") {
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      visNyttPassord();
    }
  });
}

function startApp() {
  console.log("Starter app");
  visLogin();
}

startApp();
