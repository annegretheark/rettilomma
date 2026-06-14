/*
  Hestebehandler login/logout tekst-fiks
  Legg denne inn ETTER auth.js / beh-app.js i hestebehandler-siden.
  Fjerner "Timeregistrering" fra hestebehandler og bruker Hestebehandler i stedet.
*/
(function () {
  "use strict";

  function erHestebehandler() {
    var sti = (window.location.pathname || "").toLowerCase();
    var modul = (localStorage.getItem("rettilommaValgtModul") || "").toLowerCase();
    return sti.includes("hestebehandler") || modul === "hestebehandler";
  }

  function settTekst(selector, tekst) {
    var el = document.querySelector(selector);
    if (el) el.textContent = tekst;
  }

  function fiksHestebehandlerTekster() {
    if (!erHestebehandler()) return;

    document.title = "Hestebehandler";

    // Login-siden i felles auth/index
    settTekst("#loginSide h1", "Hestebehandler");
    settTekst("#appSide > .kort h1", "Hestebehandler");
    settTekst("#timerSide h2", "Registrer behandling");

    // Knapper/meny skal ikke si timer når modulen er hestebehandler
    settTekst("#visTimerKnapp", "Behandlinger");
    settTekst("#loggUtKnapp", "Logg ut av Hestebehandler");

    // Gamle hestebehandler-menyen hadde "Behandlinger"
    document.querySelectorAll("a, button, h1, h2, h3").forEach(function (el) {
      var t = (el.textContent || "").trim();
      if (t === "Timeregistrering") el.textContent = "Hestebehandler";
      if (t === "Behandlinger") el.textContent = "Behandlinger";
      if (t === "Registrer timer") el.textContent = "Registrer behandling";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fiksHestebehandlerTekster);
  } else {
    fiksHestebehandlerTekster();
  }

  // Auth/app-script kan tegne skjermen etterpå, så vi kjører én ekstra gang.
  setTimeout(fiksHestebehandlerTekster, 300);
  setTimeout(fiksHestebehandlerTekster, 1000);
})();
