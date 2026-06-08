console.log("kreditnota.js lastet - delegert til faktura.js");

/*
  AGK FIX 7082:
  Kreditnota håndteres nå i faktura.js, fordi kreditnota skal hentes fra
  fakturaer-tabellen og ikke fra timer.fakturanr.
  Denne filen er beholdt som trygg bro hvis den fortsatt er lastet i prosjektet.
*/

(function () {
  function kobleKreditnotaBro() {
    const knapp = document.getElementById("skrivUtKreditnotaKnapp");
    if (!knapp) return;

    knapp.onclick = async function () {
      if (typeof window.lagKreditnotaPdf === "function") {
        await window.lagKreditnotaPdf();
        return;
      }

      alert("Kreditnota-funksjonen er ikke lastet. Sjekk at faktura.js er lastet før kreditnota.js.");
    };
  }

  window.kobleKreditnotaKnapp = kobleKreditnotaBro;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", kobleKreditnotaBro);
  } else {
    kobleKreditnotaBro();
  }

  window.addEventListener("load", kobleKreditnotaBro);
})();
