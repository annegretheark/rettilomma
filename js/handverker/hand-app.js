console.log("NY hand-app.js er lastet");

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
koble("visAdminKonsollKnapp", "click", tryggFunksjon("visAdminKonsollSide"));
koble("visTimerAdminKnapp", "click", tryggFunksjon("visTimerForAnsattSide"));
koble("visTilbudKnapp", "click", tryggFunksjon("visTilbudSide"));
koble("visFakturaKnapp", "click", tryggFunksjon("visFakturaSide"));
koble("varerKnapp", "click", tryggFunksjon("visVarerSide"));
koble("visLonnKnapp", "click", tryggFunksjon("visLonnSide"));
koble("visKundeKnapp", "click", tryggFunksjon("visKundeSide"));
koble("visAnsattKnapp", "click", tryggFunksjon("visAnsattSide"));
koble("visFirmaKnapp", "click", tryggFunksjon("visFirmaSide"));
koble("visBackupKnapp", "click", tryggFunksjon("visBackupSide"));
koble("visTestKnapp", "click", tryggFunksjon("visTestSide"));
koble("visModulerKnapp", "click", tryggFunksjon("visModulerSide"));
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
koble("leggTilTilbudLinjeKnapp", "click", tryggFunksjon("leggTilTilbudLinje"));
koble("lagreTilbudKnapp", "click", tryggFunksjon("lagreTilbud"));
koble("nyttTilbudKnapp", "click", tryggFunksjon("nullstillTilbudSkjema"));
koble("oppdaterTilbudKnapp", "click", tryggFunksjon("lastTilbud"));
koble("kreditnotaKnapp", "click", tryggFunksjon("visKreditnotaPrompt"));
koble("okonomiOversiktKnapp", "click", tryggFunksjon("visOkonomiOversikt"));
koble("backupKnapp", "click", tryggFunksjon("backup"));
koble("lagreBilKnapp", "click", tryggFunksjon("lagreBil"));

koble("kjorLonnKnapp", "click", tryggFunksjon("kjorLonn"));
koble("trekkExcelKnapp", "click", tryggFunksjon("eksporterTrekkExcel"));
koble("utbetalingExcelKnapp", "click", tryggFunksjon("eksporterUtbetalingerExcel"));

// Lønnsslippknapper er koblet direkte i handverker/index.html for å unngå doble event-handlere.

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

async function startApp() {
  console.log("Starter app");
  document.documentElement.classList.remove("ril-auth-ready", "ril-admin-ready");
  // Sysadm-modus styres av hand-role-core, ikke nullstill her.
  // HAND_FIX_PARTIAL_READY: Vent til HTML-delene i partials er lastet.
  // Dette hindrer blinking/flicker og at knapper kobles før de finnes.
  if (window.handPartialerKlare && !window.__handPartialerVentet) {
    window.__handPartialerVentet = true;
    try { await window.handPartialerKlare; } catch (e) { console.warn("Partialer ble ikke ferdig lastet:", e); }
  }

  try {
    if (!window.supabaseClient || !supabaseClient.auth) {
      document.documentElement.classList.remove("ril-admin-ready");
    document.documentElement.classList.add("ril-auth-ready");
    if (typeof window.visLogin === "function") window.visLogin();
      return;
    }

    const { data } = await supabaseClient.auth.getSession();
    const session = data && data.session ? data.session : null;
    const email = String(session?.user?.email || "").toLowerCase();

    if (!session || !email) {
      document.documentElement.classList.remove("ril-admin-ready");
      document.documentElement.classList.add("ril-auth-ready");
      if (typeof window.visLogin === "function") window.visLogin();
      try {
        const params = new URLSearchParams(window.location.search || "");
        const firmaSlug = params.get("firma") || params.get("kunde") || "";
        if (firmaSlug) {
          const melding = document.getElementById("loginMelding");
          if (melding) melding.textContent = "Logg inn for å åpne kundelinken: " + firmaSlug;
        }
      } catch (e) {}
      return;
    }

    window.innloggetEpost = email;

    let ansattData = null;
    try {
      const { data: ansatte, error } = await supabaseClient
        .from("hand_ansatt")
        .select("*")
        .eq("epost", email)
        .limit(1);

      if (!error && Array.isArray(ansatte) && ansatte.length) {
        ansattData = ansatte[0];
        window.innloggetAnsattId = ansattData.id || "";
      }
    } catch (e) {
      console.warn("Kunne ikke hente ansatt ved oppfrisking:", e);
    }

    const rolleStatus = typeof window.handResolveRole === "function"
      ? await window.handResolveRole(ansattData)
      : { rolle: String(ansattData?.rolle || "").toLowerCase(), admin: false, sys: false };
    window.innloggetRolle = rolleStatus.rolle;
    window.erSystemadmin = rolleStatus.sys === true;
    window.erAdmin = rolleStatus.admin === true;

    if (typeof window.visApp === "function") {
      await window.visApp();
    } else {
      const loginSide = document.getElementById("loginSide");
      const appSide = document.getElementById("appSide");
      if (loginSide) loginSide.classList.add("skjult");
      if (appSide) appSide.classList.remove("skjult");
    }

    if (window.erAdmin) {
      document.querySelectorAll(".admin-only").forEach(el => {
        el.style.display = "";
        el.classList.remove("skjult", "hidden");
      });
      if (typeof window.skjulAlleSider === "function") window.skjulAlleSider();
      if (typeof window.skjulSystemadminHvisIkkeSystemadmin === "function") window.skjulSystemadminHvisIkkeSystemadmin();
    } else {
      document.querySelectorAll(".admin-only").forEach(el => {
        el.style.display = "none";
        el.classList.add("skjult");
      });
      if (typeof window.visTimerSide === "function") window.visTimerSide();
    }

    if (typeof window.startModulerEtterInnlogging === "function") {
      setTimeout(window.startModulerEtterInnlogging, 800);
    }
  } catch (e) {
    console.warn("Oppstart feilet, viser login:", e);
    if (typeof window.visLogin === "function") window.visLogin();
  }
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

  await supabaseClient.from("hand_time").delete().neq("id", 0);

  let slettAnsatteQuery = supabaseClient
    .from("hand_ansatt")
    .delete();

  if (behold) {
    slettAnsatteQuery = slettAnsatteQuery.neq("epost", behold);
  } else {
    slettAnsatteQuery = slettAnsatteQuery.neq("id", 0);
  }

  await slettAnsatteQuery;

  console.log("Gamle data slettet");

  for (let epost of testEposter) {
    await supabaseClient.from("hand_ansatt").insert({
      navn: epost.split("@")[0],
      epost: epost,
      timepris: 1100
    });
  }

  console.log("Ansatte opprettet");

  for (let i = 1; i <= 10; i++) {
    await supabaseClient.from("hand_kunde").insert({
      navn: "TEST_KUNDE_" + i,
      epost: "kunde" + i + "@test.no"
    });
  }

  console.log("Kunder opprettet");

  const { data: ansatte } = await supabaseClient.from("hand_ansatt").select("*");
  const { data: kunder } = await supabaseClient.from("hand_kunde").select("*");

  for (let i = 0; i < 200; i++) {
    const ansatt = ansatte[Math.floor(Math.random() * ansatte.length)];
    const kunde = kunder[Math.floor(Math.random() * kunder.length)];

    await supabaseClient.from("hand_time").insert({
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

// SIGNED_IN module restart removed to reduce flicker

// load module restart removed to reduce flicker



// HAND_FIX_PARTIAL_READY: Koble viktige knapper på nytt etter at partials er lastet.
// Noen knapper finnes ikke når scriptet først leses, fordi HTML-delene hentes med fetch().
(function(){
  function bind(id, event, fnName){
    const el = document.getElementById(id);
    const fn = window[fnName];
    if (!el || typeof fn !== "function") return;
    const key = "handBound_" + event + "_" + fnName;
    if (el.dataset && el.dataset[key] === "1") return;
    el.addEventListener(event, fn);
    if (el.dataset) el.dataset[key] = "1";
  }

  window.handKobleKnapperEtterPartials = function(){
    bind("loginKnapp", "click", "loggInn");
    bind("glemtPassordKnapp", "click", "glemtPassord");
    bind("lagreNyttPassordKnapp", "click", "lagreNyttPassord");
    bind("tilbakeTilLoginKnapp", "click", "visLogin");
    bind("loggUtKnapp", "click", "loggUt");
    bind("visTimerKnapp", "click", "visTimerSide");
    bind("visJobberKnapp", "click", "visJobberSide");
    bind("visKundeKnapp", "click", "visKundeSide");
    bind("visTilbudKnapp", "click", "visTilbudSide");
    bind("visFakturaKnapp", "click", "visFakturaSide");
    bind("visLonnKnapp", "click", "visLonnSide");
    bind("visFravaerKnapp", "click", "visFravaerSide");
    bind("visAnsattKnapp", "click", "visAnsattSide");
    bind("visFirmaKnapp", "click", "visFirmaSide");
    bind("visModulerKnapp", "click", "visModulerSide");
    bind("visBackupKnapp", "click", "visBackupSide");
    bind("visTestKnapp", "click", "visTestSide");
  };

  document.addEventListener("handPartialerLastet", window.handKobleKnapperEtterPartials);
  document.addEventListener("DOMContentLoaded", function(){ setTimeout(window.handKobleKnapperEtterPartials, 50); });
  window.addEventListener("load", function(){ setTimeout(window.handKobleKnapperEtterPartials, 250); });
})();
