/* RIL 20260705 systematisk fix:
   - Ingen egen rendering av Min bil, for å stoppe blinking.
   - Lar original hand-biler.js styre varer på bil, priser og lagerlogg.
   - Skjuler bare biladministrasjon for vanlig bruker.
   - Sørger for at lagerlogg tegnes etter bil-lager og ved bilbytte. */
(function () {
  "use strict";
  if (window.__rilSystematiskMinBilLagerloggFix) return;
  window.__rilSystematiskMinBilLagerloggFix = true;

  function $(id) { return document.getElementById(id); }
  function tekst(v) { return String(v == null ? "" : v).trim(); }
  function lav(v) { return tekst(v).toLowerCase(); }

  function erAdmin() {
    var rolle = lav(window.innloggetRolle || window.handInnloggetRolle || localStorage.getItem("handInnloggetRolle") || localStorage.getItem("innloggetRolle"));
    return window.erAdmin === true || localStorage.getItem("rilAdminModus") === "ja" || ["admin","administrator","eier","owner","sysadm","sysadmin","systemadmin"].indexOf(rolle) !== -1;
  }

  function vis(el) {
    if (!el) return;
    el.hidden = false;
    el.classList.remove("skjult", "hidden", "modul-skjult");
    el.style.visibility = "";
    el.style.display = "";
  }

  function skjul(el) {
    if (!el) return;
    el.hidden = true;
    el.classList.add("skjult");
    el.style.display = "none";
  }

  function frigjorHvisSortSkjerm() {
    document.documentElement.classList.remove("hand-role-locking");
    document.documentElement.classList.add("ril-role-ready", "hand-role-ready", "ril-auth-ready");
    var app = $("appSide"), login = $("loginSide");
    if (app && (window.innloggetEpost || localStorage.getItem("handInnloggetEpost") || localStorage.getItem("innloggetEpost"))) {
      vis(app);
      if (login) skjul(login);
    }
  }

  function tilpassVanligBruker() {
    frigjorHvisSortSkjerm();
    var side = $("bilerSide");
    if (!side) return;

    if (erAdmin()) {
      document.documentElement.classList.remove("ril-vanlig-bruker");
      return;
    }
    document.documentElement.classList.add("ril-vanlig-bruker");

    var h2 = side.querySelector("h2");
    if (h2) h2.textContent = "Min bil / lager";

    var intro = side.querySelector(":scope > p:first-of-type");
    if (intro) intro.textContent = "Velg bil under hvis du må fylle en annen bil. Varer og lagerlogg vises for valgt bil.";

    skjul($("nyBilKnapp"));
    skjul($("bilSkjemaOmrade"));
    skjul($("bilListe"));

    var hentetAv = $("bilLagerHentetAv");
    if (hentetAv) {
      hentetAv.value = window.innloggetEpost || localStorage.getItem("handInnloggetEpost") || localStorage.getItem("innloggetEpost") || "";
      skjul(hentetAv.parentElement);
    }

    var select = $("bilLagerBilValg");
    if (select) {
      select.disabled = false;
      delete select.dataset.rilLåstTilAktivBil;
      if (!select.value) {
        var aktiv = window.aktivBilId || localStorage.getItem("aktivBilId") || localStorage.getItem("rilAktivBilId") || "";
        if (aktiv && Array.from(select.options || []).some(function (o) { return String(o.value) === String(aktiv); })) {
          select.value = aktiv;
        }
      }
    }
  }

  var loggTimer = null;
  function tegnVarerOgLogg() {
    clearTimeout(loggTimer);
    loggTimer = setTimeout(function () {
      try { tilpassVanligBruker(); } catch (e) { console.warn("Tilpass vanlig bruker feilet:", e); }
      try { if (typeof window.tegnBilLager === "function") window.tegnBilLager(); } catch (e) { console.warn("Kunne ikke tegne bil-lager:", e); }
      try { if (typeof window.tegnLagerloggForBil === "function") window.tegnLagerloggForBil(); } catch (e) { console.warn("Kunne ikke tegne lagerlogg:", e); }
    }, 120);
  }

  // Pakk original lastBilerOgBilLager slik at lagerlogg tegnes etter at original data er hentet.
  function pakkLastBilerOgBilLager() {
    if (typeof window.lastBilerOgBilLager !== "function" || window.lastBilerOgBilLager.__rilSystematiskPakket) return;
    var original = window.lastBilerOgBilLager;
    var pakket = async function () {
      var res = await original.apply(this, arguments);
      tegnVarerOgLogg();
      return res;
    };
    pakket.__rilSystematiskPakket = true;
    window.lastBilerOgBilLager = pakket;
  }

  function start() {
    pakkLastBilerOgBilLager();
    tilpassVanligBruker();
    tegnVarerOgLogg();
  }

  document.addEventListener("DOMContentLoaded", function () {
    start();
    setTimeout(start, 400);
    setTimeout(start, 1200);
  });
  window.addEventListener("load", function () {
    start();
    setTimeout(start, 800);
  });
  document.addEventListener("handPartialerLastet", function () { setTimeout(start, 100); });

  document.addEventListener("change", function (event) {
    if (event.target && event.target.id === "bilLagerBilValg") {
      var s = event.target;
      if (s.value) {
        window.aktivBilId = s.value;
        localStorage.setItem("aktivBilId", s.value);
        var opt = s.selectedOptions && s.selectedOptions[0];
        if (opt) {
          window.aktivBilNavn = opt.textContent || "";
          localStorage.setItem("aktivBilNavn", opt.textContent || "");
        }
      }
      tegnVarerOgLogg();
    }
  }, true);

  document.addEventListener("click", function (event) {
    if (event.target && event.target.closest && event.target.closest("#visBilerKnapp")) {
      setTimeout(start, 150);
      setTimeout(start, 700);
    }
  }, true);
})();
