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
koble("visFakturaKnapp", "click", tryggFunksjon("visFakturaSide"));
koble("varerKnapp", "click", tryggFunksjon("visVarerSide"));
koble("visLonnKnapp", "click", tryggFunksjon("visLonnSide"));
koble("visKundeKnapp", "click", tryggFunksjon("visKundeSide"));
koble("visAnsattKnapp", "click", tryggFunksjon("visAnsattSide"));
koble("visFirmaKnapp", "click", tryggFunksjon("visFirmaSide"));
koble("visBackupKnapp", "click", tryggFunksjon("visBackupSide"));
koble("visTestKnapp", "click", tryggFunksjon("visTestSide"));
koble("visModulerKnapp", "click", tryggFunksjon("visModulerSide"));
koble("visHovslagerKnapp", "click", tryggFunksjon("visHovslagerModul"));
koble("visVeterinaerKnapp", "click", tryggFunksjon("visVeterinaerModul"));
koble("lagreModulerKnapp", "click", tryggFunksjon("lagreModuler"));

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
koble("kreditnotaKnapp", "click", tryggFunksjon("visKreditnotaPrompt"));
koble("okonomiOversiktKnapp", "click", tryggFunksjon("visOkonomiOversikt"));
koble("backupKnapp", "click", tryggFunksjon("backup"));
koble("lagreBilKnapp", "click", tryggFunksjon("lagreBil"));

koble("kjorLonnKnapp", "click", tryggFunksjon("kjorLonn"));
koble("lonnsslippKnapp", "click", tryggFunksjon("lagLonnsslipper"));
koble("trekkExcelKnapp", "click", tryggFunksjon("eksporterTrekkExcel"));
koble("utbetalingExcelKnapp", "click", tryggFunksjon("eksporterUtbetalingerExcel"));
koble("lonnsslippKnapp", "click", tryggFunksjon("lagLonnsslipper"));
koble("lonnsslippKopiKnapp", "click", () => lagLonnsslipper(true));
koble("lonnsslippAlleKnapp", "click", () => lagLonnsslipper(false));
koble("lonnsslippAlleKopiKnapp", "click", () => lagLonnsslipper(true));
koble("lonnsslippKopiKnapp", "click", tryggFunksjon("lagLonnsslipperKopi"));
koble("lonnsslippAlleKnapp", "click", tryggFunksjon("lagLonnsslipper"));
koble("lonnsslippAlleKopiKnapp", "click", tryggFunksjon("lagLonnsslipperKopi"));

koble("kjorHelsetestKnapp", "click", tryggFunksjon("kjorHelsetest"));
koble("kjorStresstestKnapp", "click", tryggFunksjon("kjorStresstest"));
koble("testDobbeltregistreringKnapp", "click", tryggFunksjon("testDobbeltregistrering"));
koble("testBlankLagringKnapp", "click", tryggFunksjon("testBlankLagring"));
koble("testLonnKnapp", "click", tryggFunksjon("testLonn"));
koble("testFakturaGrunnlagKnapp", "click", tryggFunksjon("testFakturaGrunnlag"));
koble("testMvaKnapp", "click", tryggFunksjon("testMva"));
koble("testFakturaSperreKnapp", "click", tryggFunksjon("testFakturaSperre"));
koble("testMvaSperreKnapp", "click", tryggFunksjon("testMvaSperre"));
koble("testRettigheterKnapp", "click", tryggFunksjon("testRettigheter"));
koble(
  "lagStresstestFakturaKnapp",
  "click",
  tryggFunksjon("lagStresstestFakturaData")
);
koble("slettKunTestdataKnapp", "click", tryggFunksjon("slettKunTestdata"));

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

async function stressTest() {
  const behold = window.innloggetEpost || "";

  const testEposter = [
    "kurs@jobbsmartkurs.no",
    "lykke@jobbsmartkurs.no",
    "rotern@jobbsmartkurs.no",
    "taxi@jobbsmartkurs.no",
    "tulling@jobbsmartkurs.no",
    "annegrethek@hotmail.com"
  ];

  console.log("Starter stresstest...");

  await supabaseClient.from("timer").delete().neq("id", 0);

  let slettAnsatteQuery = supabaseClient
    .from("ansatte")
    .delete();

  if (behold) {
    slettAnsatteQuery = slettAnsatteQuery.neq("epost", behold);
  } else {
    slettAnsatteQuery = slettAnsatteQuery.neq("id", 0);
  }

  await slettAnsatteQuery;

  console.log("Gamle data slettet");

  for (let epost of testEposter) {
    await supabaseClient.from("ansatte").insert({
      navn: epost.split("@")[0],
      epost: epost,
      timepris: 1100
    });
  }

  console.log("Ansatte opprettet");

  for (let i = 1; i <= 10; i++) {
    await supabaseClient.from("kunder").insert({
      navn: "TEST_KUNDE_" + i,
      epost: "kunde" + i + "@test.no"
    });
  }

  console.log("Kunder opprettet");

  const { data: ansatte } = await supabaseClient.from("ansatte").select("*");
  const { data: kunder } = await supabaseClient.from("kunder").select("*");

  for (let i = 0; i < 200; i++) {
    const ansatt = ansatte[Math.floor(Math.random() * ansatte.length)];
    const kunde = kunder[Math.floor(Math.random() * kunder.length)];

    await supabaseClient.from("timer").insert({
      ansatt_id: ansatt.id,
      kunde_id: kunde.id,
      dato: "2026-05-01",
      timer: Math.random() * 8,
      beskrivelse: "TEST",
      fakturerbar: "ja"
    });
  }

  console.log("Timer opprettet");

  alert("Stresstest ferdig 🚀");
}

window.stressTest = stressTest;
document.addEventListener("DOMContentLoaded", () => {

  document
    .getElementById("visModulerKnapp")
    ?.addEventListener("click", () => {

      if (typeof window.visModulerSide === "function") {
        window.visModulerSide();
      } else {
        alert("Fant ikke visModulerSide()");
      }

    });

});

async function startModulerEtterInnlogging() {
  if (typeof window.lastModulerFraDatabase === "function") {
    await window.lastModulerFraDatabase();
  }

  if (typeof window.sjekkForstegangsModulvalg === "function") {
    await window.sjekkForstegangsModulvalg();
  }
}

window.startModulerEtterInnlogging = startModulerEtterInnlogging;

if (typeof supabaseClient !== "undefined" && supabaseClient.auth) {
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") {
      setTimeout(startModulerEtterInnlogging, 1200);
    }
  });
}

window.addEventListener("load", () => {
  setTimeout(startModulerEtterInnlogging, 1800);
});
