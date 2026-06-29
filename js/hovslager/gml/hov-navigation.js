window.__HOV_DIAG_NAV_LOADED = true;
// Hovslager navigation - fast og robust sidebytte
console.log("hov-navigation.js lastet");

(function () {
  const SIDE_IDS = [
    "jobbSide",
    "hesterSide",
    "kundeSide",
    "fakturaSide",
    "firmaSide",
    "prislisteSide"
  ];

  function visSide(sideId) {
    SIDE_IDS.forEach(function (id) {
      const side = document.getElementById(id);
      if (!side) return;

      if (id === sideId) {
        side.classList.remove("skjult");
      } else {
        side.classList.add("skjult");
      }
    });

    return true;
  }

  window.__hovVisSide = visSide;
  window.visSide = visSide;

  function kobleMenyDirekte() {
    const koblinger = [
      ["visJobberKnapp", "jobbSide"],
      ["visHesterKnapp", "hesterSide"],
      ["visKunderKnapp", "kundeSide"],
      ["visFakturaKnapp", "fakturaSide"],
      ["visFirmaKnapp", "firmaSide"]
    ];

    koblinger.forEach(function (par) {
      const knapp = document.getElementById(par[0]);
      const sideId = par[1];

      if (!knapp) return;

      knapp.onclick = function (ev) {
        ev.preventDefault();
        visSide(sideId);
      };
    });

    const prislisteKnapp = document.querySelector('button[onclick*="prislisteSide"]');
    if (prislisteKnapp) {
      prislisteKnapp.onclick = function (ev) {
        ev.preventDefault();
        visSide("prislisteSide");
      };
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kobleMenyDirekte);
  } else {
    kobleMenyDirekte();
  }

  setTimeout(kobleMenyDirekte, 300);
  setTimeout(kobleMenyDirekte, 1000);
})();
