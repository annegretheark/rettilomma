console.log("vipps-faktura-fix.js lastet - Vipps flyttet opp 7075");

/*
  Flytter Vipps-blokken opp på faktura/PDF og bruker dynamisk firma-info.
  Lastes etter/med fakturaoppsettet, men påvirker ikke skjermdesign.
*/
(function () {
  "use strict";

  function tekst(v) {
    return String(v || "").trim();
  }

  function hentVippsNummer(firma) {
    return tekst(
      firma?.vipps_nummer ||
      firma?.vippsnummer ||
      firma?.vipps ||
      firma?.vippsNr ||
      ""
    );
  }

  function hentVippsMottaker(firma) {
    return tekst(
      firma?.vipps_mottaker ||
      firma?.vippsmottaker ||
      firma?.vippsMottaker ||
      firma?.navn ||
      ""
    );
  }

  function tegnVippsBlokk(doc, firma) {
    if (!doc || !firma) return;

    const vippsNr = hentVippsNummer(firma);
    if (!vippsNr) return;

    const mottaker = hentVippsMottaker(firma);
    const side = doc.getNumberOfPages ? doc.getNumberOfPages() : 1;
    doc.setPage(side);

    // Litt opp fra bunnen, over brevfoten.
    const x = 14;
    const y = 255;

    try {
      doc.setFontSize(11);
      doc.text("Betal med Vipps", x, y);

      doc.setFontSize(9);
      const linje = mottaker
        ? "Vippsnummer: " + vippsNr + "   Mottaker: " + mottaker
        : "Vippsnummer: " + vippsNr;

      doc.text(linje, x, y + 6);
      doc.text("Merk betalingen med fakturanummer/kundenavn.", x, y + 11);
    } catch (e) {
      console.warn("Kunne ikke tegne Vipps-blokk:", e);
    }
  }

  function installerVippsPatch() {
    if (typeof window.tegnBrevfotAlleSiderPdf !== "function") {
      setTimeout(installerVippsPatch, 300);
      return;
    }

    if (window.tegnBrevfotAlleSiderPdf.__vipps7075) return;

    const original = window.tegnBrevfotAlleSiderPdf;

    window.tegnBrevfotAlleSiderPdf = function (doc, firma) {
      const resultat = original.apply(this, arguments);
      tegnVippsBlokk(doc, firma || {});
      return resultat;
    };

    window.tegnBrevfotAlleSiderPdf.__vipps7075 = true;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installerVippsPatch);
  } else {
    installerVippsPatch();
  }

  window.addEventListener("load", installerVippsPatch);
})();
