/* Rett i Lomma - stabil navigasjon 7055
   Én navigasjon. Ingen adminKonsollSide som ikke finnes i HTML.
*/
(function () {
  const ARBEIDSSIDER = [
    "timerSide", "jobberSide", "tilbudSide", "backupSide", "fakturaSide", "varerSide", "bilerSide",
    "kundeSide", "ansattSide", "firmaSide", "bilBestillingerSide", "testSide", "lonnPanel", "fravaerSide", "modulerSide", "sysadminPanelSide"
  ];

  function hent(id) { return document.getElementById(id); }

  function visElement(id) {
    const el = hent(id);
    if (!el) return;
    el.classList.remove("hidden", "skjult", "modul-skjult");
    el.style.display = "";
  }

  function skjulElement(id) {
    const el = hent(id);
    if (!el) return;
    el.classList.add("hidden", "skjult");
    el.style.display = "none";
  }

  function lukkMenyer() {
    document.querySelectorAll(".meny-gruppe.apen").forEach(function (gruppe) {
      gruppe.classList.remove("apen");
    });
  }

  function oppdaterAdminVisning() {
    const admin = window.erAdmin === true && localStorage.getItem("rilAdminModus") === "ja";
    const innloggetEmail = String(window.innloggetEpost || localStorage.getItem("handInnloggetEpost") || "").toLowerCase();
    const erGreknuts = innloggetEmail === "greknuts@online.no";
    const sysadmin = (window.erSystemadmin === true || erGreknuts) && localStorage.getItem("rilSysadminModus") === "ja";

    if (document.body) {
      document.body.classList.toggle("ril-er-admin", admin);
      document.body.classList.toggle("ril-vanlig-bruker", !admin);
    }

    document.querySelectorAll(".admin-only").forEach(function (element) {
      if (admin) {
        element.classList.remove("hidden", "skjult");
        element.style.display = "";
      } else {
        element.classList.add("hidden", "skjult");
        element.style.display = "none";
      }
    });

    document.querySelectorAll(".systemadmin-only").forEach(function (element) {
      if (sysadmin) {
        element.classList.remove("hidden", "skjult");
        element.style.display = "";
      } else {
        element.classList.add("hidden", "skjult");
        element.style.display = "none";
      }
    });

    if (!admin) skjulElement("adminAnsattRad");

    if (typeof window.begrensBilLagerForVanligBruker === "function") {
      setTimeout(window.begrensBilLagerForVanligBruker, 20);
    }
  }

  function skjulArbeidssider() {
    ARBEIDSSIDER.forEach(skjulElement);
    skjulElement("adminAnsattRad");
  }

  function skjulAlleSider() { skjulArbeidssider(); }

  function krevAdmin(melding) {
    if (window.erAdmin === true && localStorage.getItem("rilAdminModus") === "ja") return true;
    alert(melding || "Du har ikke tilgang til denne funksjonen.");
    return false;
  }

  function visSide(sideId) {
    visElement("appSide");
    skjulArbeidssider();
    visElement(sideId);
    lukkMenyer();
  }

  function visLogin() {
    visElement("loginSide");
    skjulElement("nyttPassordSide");
    skjulElement("appSide");
  }

  function visNyttPassord() {
    skjulElement("loginSide");
    visElement("nyttPassordSide");
    skjulElement("appSide");
  }

  async function visApp() {
    skjulElement("loginSide");
    skjulElement("nyttPassordSide");
    visElement("appSide");
    oppdaterAdminVisning();

    if (typeof window.lastModulerFraDatabase === "function") await window.lastModulerFraDatabase();
    if (typeof window.oppdaterModulVisning === "function") window.oppdaterModulVisning();
    oppdaterAdminVisning();
    if (typeof window.lastKunder === "function") await window.lastKunder();
    if (typeof window.lastProsjekter === "function") await window.lastProsjekter();
    if (typeof window.lastAnsatte === "function") await window.lastAnsatte();
    if (typeof window.settDagensDato === "function") window.settDagensDato();
    if (typeof window.lastTimer === "function") await window.lastTimer();
    else if (typeof window.tegnTimer === "function") window.tegnTimer();
    if (typeof window.fyllFirmaSkjema === "function") window.fyllFirmaSkjema();
    if (typeof window.tegnFirmaInfo === "function") window.tegnFirmaInfo();

    visTimerSide();
  }

  function visTimerSide() {
    oppdaterAdminVisning();
    visSide("timerSide");
    if (typeof window.reparerBilvalg === "function") setTimeout(window.reparerBilvalg, 20);
    if (window.erAdmin === true && localStorage.getItem("rilAdminModus") === "ja") {
      visElement("adminAnsattRad");
      if (typeof window.fyllAdminAnsattValg === "function") window.fyllAdminAnsattValg();
    } else {
      skjulElement("adminAnsattRad");
    }
  }


  function visJobberSide() {
    oppdaterAdminVisning();
    visSide("jobberSide");
    if (typeof window.lastJobber === "function") setTimeout(window.lastJobber, 20);
  }

  function visTimerForAnsattSide() { visTimerSide(); }

  function visTilbudSide() {
    if (!krevAdmin("Du har ikke tilgang til tilbud.")) return;
    visSide("tilbudSide");
    if (typeof window.fyllTilbudKundeDropdown === "function") window.fyllTilbudKundeDropdown();
    if (typeof window.lastTilbud === "function") setTimeout(window.lastTilbud, 20);
  }

  function visFakturaSide() {
    if (!krevAdmin("Du har ikke tilgang til faktura.")) return;
    visSide("fakturaSide");
    if (typeof window.fyllOkonomiKundeValg === "function") window.fyllOkonomiKundeValg();
  }

  function visBackupSide() {
    if (!krevAdmin("Du har ikke tilgang til backup.")) return;
    visSide("backupSide");
  }

  function visVarerSide() {
    if (!krevAdmin("Du har ikke tilgang til varer.")) return;
    visSide("varerSide");
    if (typeof window.lastVarer === "function") setTimeout(window.lastVarer, 20);
  }

  function visBilerSide() {
    // Vanlig bruker skal kunne fylle/vedlikeholde sin egen bil.
    // Admin ser hele bilregisteret/bil-lageret.
    oppdaterAdminVisning();
    visSide("bilerSide");
    if (typeof window.lastBiler === "function") setTimeout(window.lastBiler, 20);
    if (typeof window.lastBilLager === "function") setTimeout(window.lastBilLager, 20);
    if (typeof window.reparerBilvalg === "function") setTimeout(window.reparerBilvalg, 50);
    if (typeof window.fyllBilvalgTrygt === "function") setTimeout(window.fyllBilvalgTrygt, 100);
    if (typeof window.begrensBilLagerForVanligBruker === "function") setTimeout(window.begrensBilLagerForVanligBruker, 180);
  }

  async function visKundeSide() {
    if (!krevAdmin("Du har ikke tilgang til kunderegister.")) return;
    visSide("kundeSide");
    if (typeof window.lastKunder === "function") await window.lastKunder();
  }

  async function visAnsattSide() {
    if (!krevAdmin("Du har ikke tilgang til ansattregister.")) return;
    visSide("ansattSide");
    if (typeof window.tegnTrekkListe === "function") window.tegnTrekkListe();
    if (typeof window.lastAnsatte === "function") await window.lastAnsatte();
  }

  function visFirmaSide() {
    if (!krevAdmin("Du har ikke tilgang til firma.")) return;
    visSide("firmaSide");
    if (typeof window.lastFirma === "function") window.lastFirma();
    else if (typeof window.fyllFirmaSkjema === "function") window.fyllFirmaSkjema();
  }

  function visBilBestillingerSide() {
    if (!krevAdmin("Du har ikke tilgang til bilbestillinger.")) return;
    visSide("bilBestillingerSide");
    if (typeof window.handLastBilBestillinger === "function") setTimeout(window.handLastBilBestillinger, 20);
  }

  async function visLonnSide() {
    if (!krevAdmin("Du har ikke tilgang til lønn.")) return;
    visSide("lonnPanel");
    if (typeof window.lastAnsatte === "function") await window.lastAnsatte();
    else if (typeof window.fyllLonnAnsattValg === "function") window.fyllLonnAnsattValg(window.ansatte || []);
  }


  async function visFravaerSide() {
    oppdaterAdminVisning();
    visSide("fravaerSide");
    if (typeof window.lastFravaerFlexi === "function") await window.lastFravaerFlexi();
  }

  function visTestSide() {
    if (!krevAdmin("Du har ikke tilgang til testpanel.")) return;
    visSide("testSide");
  }

  function visModulerSide() {
    const email = String(window.innloggetEpost || localStorage.getItem("handInnloggetEpost") || "").toLowerCase();
    const sysadmin = window.erSystemadmin === true || email === "greknuts@online.no";
    if (!sysadmin) { alert("Moduler er kun for systemadmin."); return; }
    visSide("modulerSide");
    if (typeof window.lastModulerFraDatabase === "function") window.lastModulerFraDatabase();
    if (typeof window.tegnModulGui === "function") window.tegnModulGui();
  }

  function bindMeny(knappId) {
    const knapp = hent(knappId);
    if (!knapp || knapp.dataset.rilMenyBindet === "1") return;
    knapp.dataset.rilMenyBindet = "1";
    knapp.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      const gruppe = knapp.closest(".meny-gruppe");
      if (!gruppe) return;
      document.querySelectorAll(".meny-gruppe.apen").forEach(function (g) {
        if (g !== gruppe) g.classList.remove("apen");
      });
      gruppe.classList.toggle("apen");
    });
  }

  function bindKnapp(id, fn) {
    const knapp = hent(id);
    if (!knapp || knapp.dataset.rilNavBindet === "1") return;
    knapp.dataset.rilNavBindet = "1";
    knapp.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      fn();
    });
  }

  function bindNavigasjon() {
    bindMeny("adminMenyKnapp");
    bindMeny("lagerMenyKnapp");

    bindKnapp("visTimerKnapp", visTimerSide);
    bindKnapp("visJobberKnapp", visJobberSide);
    bindKnapp("visKundeKnapp", visKundeSide);
    bindKnapp("visTilbudKnapp", visTilbudSide);
    bindKnapp("visFakturaKnapp", visFakturaSide);
    bindKnapp("visLonnKnapp", visLonnSide);
    bindKnapp("visFravaerKnapp", visFravaerSide);
    bindKnapp("varerKnapp", visVarerSide);
    bindKnapp("visBilerKnapp", visBilerSide);
    bindKnapp("visAnsattKnapp", visAnsattSide);
    bindKnapp("visFirmaKnapp", visFirmaSide);
    bindKnapp("visBilBestillingerKnapp", visBilBestillingerSide);
    bindKnapp("visModulerKnapp", visModulerSide);
    bindKnapp("visBackupKnapp", visBackupSide);
    bindKnapp("visTestKnapp", visTestSide);

    document.addEventListener("click", function (event) {
      if (event.target && event.target.closest && event.target.closest(".meny-gruppe")) return;
      lukkMenyer();
    });
  }

  window.visLogin = visLogin;
  window.visNyttPassord = visNyttPassord;
  window.visApp = visApp;
  window.oppdaterAdminVisning = oppdaterAdminVisning;
  window.visTimerSide = visTimerSide;
  window.rilVisTimerSide = visTimerSide;
  window.visTimerForAnsattSide = visTimerForAnsattSide;
  window.visJobberSide = visJobberSide;
  window.rilVisTimerForAnsattSide = visTimerForAnsattSide;
  window.visAdminKonsollSide = visTimerSide;
  window.rilVisAdminKonsollSide = visTimerSide;
  window.visTilbudSide = visTilbudSide;
  window.visFakturaSide = visFakturaSide;
  window.visBackupSide = visBackupSide;
  window.visVarerSide = visVarerSide;
  window.visBilerSide = visBilerSide;
  window.visKundeSide = visKundeSide;
  window.visAnsattSide = visAnsattSide;
  window.visFirmaSide = visFirmaSide;
  window.visBilBestillingerSide = visBilBestillingerSide;
  window.visTestSide = visTestSide;
  window.visLonnSide = visLonnSide;
  window.visFravaerSide = visFravaerSide;
  window.visModulerSide = visModulerSide;
  window.skjulAlleSider = skjulAlleSider;
  window.skjulArbeidssider = skjulArbeidssider;
  window.visAdminKonsollHvisAdmin = function () {};

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindNavigasjon);
  } else {
    bindNavigasjon();
  }
  window.addEventListener("load", bindNavigasjon);
})();
