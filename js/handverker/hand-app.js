console.log("NY hand-app.js er lastet - ansatt jobber fix 20260627");

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
  localStorage.removeItem("rilSysadminModus");
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
    window.innloggetUserId = session.user.id || "";
    try {
      localStorage.setItem("innloggetEpost", email);
      localStorage.setItem("handInnloggetEpost", email);
      localStorage.setItem("innloggetUserId", window.innloggetUserId || "");
      localStorage.setItem("authUserId", window.innloggetUserId || "");
    } catch (e) {}

    let firmaBrukerData = null;
    let ansattData = null;
    try {
      const userId = String(session.user.id || "").trim();

      // RIL FIX 20260627: Firmaeier/admin skal finnes i hand_firma_bruker.
      // Slå opp denne tabellen FØR hand_ansatt, ellers blir eier behandlet som vanlig ansatt
      // og jobbvisningen filtrerer på ansatt_id i stedet for firma_id.
      if (userId) {
        const r = await supabaseClient
          .from("hand_firma_bruker")
          .select("*")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        if (!r.error && r.data) firmaBrukerData = r.data;
      }
      if (!firmaBrukerData && email) {
        const r = await supabaseClient
          .from("hand_firma_bruker")
          .select("*")
          .ilike("epost", email)
          .limit(1)
          .maybeSingle();
        if (!r.error && r.data) firmaBrukerData = r.data;
      }

      if (userId) {
        const r = await supabaseClient
          .from("hand_ansatt")
          .select("*")
          .eq("user_id", userId)
          .neq("aktiv", false)
          .limit(1)
          .maybeSingle();

        if (!r.error && r.data) ansattData = r.data;
      }

      if (!ansattData && email) {
        const r = await supabaseClient
          .from("hand_ansatt")
          .select("*")
          .ilike("epost", email)
          .neq("aktiv", false)
          .limit(1)
          .maybeSingle();

        if (!r.error && r.data) ansattData = r.data;
      }

      if (firmaBrukerData && firmaBrukerData.firma_id) {
        window.aktivFirmaId = String(firmaBrukerData.firma_id);
        window.handFirmaId = String(firmaBrukerData.firma_id);
        try {
          localStorage.setItem("aktivFirmaId", String(firmaBrukerData.firma_id));
          localStorage.setItem("handFirmaId", String(firmaBrukerData.firma_id));
          localStorage.setItem("firmaId", String(firmaBrukerData.firma_id));
          localStorage.setItem("firma_id", String(firmaBrukerData.firma_id));
        } catch (e) {}
      } else if (ansattData) {
        window.innloggetAnsattId = ansattData.id || "";
        window.aktivFirmaId = ansattData.firma_id || window.aktivFirmaId || "";
        try {
          localStorage.setItem("innloggetAnsattId", window.innloggetAnsattId || "");
          localStorage.setItem("ansattId", window.innloggetAnsattId || "");
          if (ansattData.firma_id) localStorage.setItem("aktivFirmaId", ansattData.firma_id);
        } catch (e) {}
      }
    } catch (e) {
      console.warn("Kunne ikke hente firma/ansatt ved oppfrisking:", e);
    }

    let rolle = String((firmaBrukerData && firmaBrukerData.rolle) || ansattData?.rolle || "").toLowerCase();
    // Stabil 2.0: greknuts er ikke hardkodet sysadm. Fallback admin håndteres i hand-stabil-2.0.js.
    window.innloggetRolle = rolle;

    // Stabil 2.0: systemadmin gis kun av rolle/tabell, ikke hardkodet e-post.
    const erSystembruker = ["systemadmin", "sysadmin", "sysadm"].includes(rolle);
    const harSystemadminRolle = erSystembruker;
    const harAdminRolle = !!firmaBrukerData || email === "greknuts@online.no" || ["admin", "eier", "owner", "administrator", "systemadmin", "sysadmin", "sysadm"].includes(rolle);

    window.erSystemadmin = harSystemadminRolle;

    window.erAdmin = harAdminRolle;
    try { localStorage.setItem("rilAdminModus", harAdminRolle ? "ja" : "nei"); } catch (e) {}
    document.documentElement.classList.add("ril-auth-ready");
    document.documentElement.classList.toggle("ril-admin-ready", !!window.erAdmin);

    if (typeof window.visApp === "function") {
      await window.visApp();
    } else {
      const loginSide = document.getElementById("loginSide");
      const appSide = document.getElementById("appSide");
      if (loginSide) loginSide.classList.add("skjult");
      if (appSide) appSide.classList.remove("skjult");
    }

    // RIL FIX 20260628: Sett tildelt/standard bil også ved automatisk oppstart
    // fra eksisterende Supabase-session. Uten dette fikk vanlig bruker ofte
    // ikke aktiv bil før Ctrl+F5, fordi loggInn()-løpet ikke ble kjørt.
    try {
      if (!window.erAdmin && ansattData && typeof window.velgAktivBilVedInnlogging === "function") {
        await window.velgAktivBilVedInnlogging(ansattData);
      }
      if (typeof window.fyllAlleBilvalg === "function") await window.fyllAlleBilvalg();
      if (typeof window.oppdaterAktivBilVisning === "function") window.oppdaterAktivBilVisning();
      if (typeof window.fyllVarevalgFraAktivBil === "function") await window.fyllVarevalgFraAktivBil();
    } catch (e) {
      console.warn("Kunne ikke sette aktiv bil ved automatisk oppstart:", e);
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

    // Ikke start Moduler automatisk etter innlogging. Det ga blink innom Moduler.
    // Moduler åpnes kun når systemadmin trykker modulknappen.
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
  // Deaktivert: skal ikke navigere eller blinke innom Moduler etter innlogging.
  return;
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
    bind("leggTilUtleggKnapp", "click", "lagreUtleggTilFaktura");
  };

  document.addEventListener("handPartialerLastet", window.handKobleKnapperEtterPartials);
  document.addEventListener("DOMContentLoaded", function(){ setTimeout(window.handKobleKnapperEtterPartials, 50); });
  window.addEventListener("load", function(){ setTimeout(window.handKobleKnapperEtterPartials, 250); });
})();
