/*
  Hovslager login/logout tekst-fiks
  Legg denne inn ETTER auth.js / hov-app.js i hovslager-siden.
  Fjerner "Timeregistrering" fra hovslager og bruker HovslagerSystem i stedet.
*/
(function () {
  "use strict";

  function erHovslager() {
    var sti = (window.location.pathname || "").toLowerCase();
    var modul = (localStorage.getItem("rettilommaValgtModul") || "").toLowerCase();
    return sti.includes("hovslager") || modul === "hovslager";
  }

  function settTekst(selector, tekst) {
    var el = document.querySelector(selector);
    if (el) el.textContent = tekst;
  }

  function fiksHovslagerTekster() {
    if (!erHovslager()) return;

    document.title = "HovslagerSystem";

    // Login-siden i felles auth/index
    settTekst("#loginSide h1", "HovslagerSystem");
    settTekst("#appSide > .kort h1", "HovslagerSystem");
    settTekst("#timerSide h2", "Registrer jobb");

    // Knapper/meny skal ikke si timer når modulen er hovslager
    settTekst("#visTimerKnapp", "Jobber");
    settTekst("#loggUtKnapp", "Logg ut av HovslagerSystem");

    // Gamle hovslager-menyen hadde "Jobber / timer"
    document.querySelectorAll("a, button, h1, h2, h3").forEach(function (el) {
      var t = (el.textContent || "").trim();
      if (t === "Timeregistrering") el.textContent = "HovslagerSystem";
      if (t === "Jobber / timer") el.textContent = "Jobber";
      if (t === "Registrer timer") el.textContent = "Registrer jobb";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fiksHovslagerTekster);
  } else {
    fiksHovslagerTekster();
  }

  // Auth/app-script kan tegne skjermen etterpå, så vi kjører én ekstra gang.
  setTimeout(fiksHovslagerTekster, 300);
  setTimeout(fiksHovslagerTekster, 1000);
})();
