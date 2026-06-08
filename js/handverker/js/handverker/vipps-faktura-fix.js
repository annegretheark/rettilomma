/* VIPPS FAKTURA FIX 2026-06-08
   Legg denne inn etter jsPDF og etter firma/faktura-script.
   Den legger Vipps tilbake på faktura-PDF og viser Vipps-boks på fakturasiden. */
(function () {
  function $(id) { return document.getElementById(id); }
  function tekst(v) { return String(v == null ? "" : v).trim(); }
  function tall(v) {
    var n = Number(String(v || 0).replace(" ", "").replace(",", "."));
    return isFinite(n) ? n : 0;
  }
  function kr(n) {
    return (Math.round(tall(n) * 100) / 100).toLocaleString("no-NO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " kr";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>\"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
    });
  }
  function hentVippsNr() {
    return tekst(
      ($("firmaVippsNr") || {}).value ||
      localStorage.getItem("firmaVippsNr") ||
      localStorage.getItem("vippsNr") ||
      (window.firma && window.firma.vipps_nummer) ||
      (window.firmaOppsett && window.firmaOppsett.vipps_nummer) ||
      ""
    ).replace(/\s+/g, "");
  }
  function hentVippsNavn() {
    return tekst(
      ($("firmaVippsNavn") || {}).value ||
      localStorage.getItem("firmaVippsNavn") ||
      (window.firma && window.firma.vipps_mottaker) ||
      (window.firmaOppsett && window.firmaOppsett.vipps_mottaker) ||
      ($("firmaNavn") || {}).value ||
      localStorage.getItem("firmaNavn") ||
      ""
    );
  }
  function lagreVippsFraFirmafelt() {
    var nr = $("firmaVippsNr");
    var navn = $("firmaVippsNavn");
    if (nr) localStorage.setItem("firmaVippsNr", nr.value || "");
    if (navn) localStorage.setItem("firmaVippsNavn", navn.value || "");
  }
  function tegnVippsPaPdf(doc) {
    try {
      if (!doc || doc.__vippsSkrevet) return;
      var nr = hentVippsNr();
      if (!nr) return;
      doc.__vippsSkrevet = true;
      var navn = hentVippsNavn();
      var h = 297;
      try { h = doc.internal.pageSize.getHeight(); } catch (e) {}
      var y = h - 34;
      if (doc.setFontSize) doc.setFontSize(11);
      if (doc.setFont) doc.setFont(undefined, "bold");
      doc.text("Betal med Vipps", 20, y);
      if (doc.setFont) doc.setFont(undefined, "normal");
      if (doc.setFontSize) doc.setFontSize(10);
      doc.text("Vippsnummer: " + nr + (navn ? "   Mottaker: " + navn : ""), 20, y + 7);
      doc.text("Merk betalingen med fakturanummer/kundenavn.", 20, y + 14);
    } catch (e) {
      console.warn("Vipps PDF-feil:", e);
    }
  }
  function patchJsPdf() {
    try {
      if (!window.jspdf || !window.jspdf.jsPDF || window.jspdf.jsPDF.__vippsPatch) return;
      var Old = window.jspdf.jsPDF;
      function WrappedJsPDF() {
        var args = Array.prototype.slice.call(arguments);
        var doc = new (Function.prototype.bind.apply(Old, [null].concat(args)))();
        if (doc && doc.save && !doc.save.__vippsPatch) {
          var oldSave = doc.save.bind(doc);
          doc.save = function () {
            tegnVippsPaPdf(doc);
            return oldSave.apply(doc, arguments);
          };
          doc.save.__vippsPatch = true;
        }
        return doc;
      }
      WrappedJsPDF.prototype = Old.prototype;
      Object.keys(Old).forEach(function (k) { try { WrappedJsPDF[k] = Old[k]; } catch (e) {} });
      WrappedJsPDF.__vippsPatch = true;
      window.jspdf.jsPDF = WrappedJsPDF;
    } catch (e) {
      console.warn("Kunne ikke patche jsPDF for Vipps:", e);
    }
  }
  function visVippsFaktura(e) {
    if (e) e.preventDefault();
    lagreVippsFraFirmafelt();
    var el = $("vippsFakturaResultat");
    if (!el) return;
    var nr = hentVippsNr();
    var navn = hentVippsNavn() || "Mottaker";
    if (!nr) {
      el.innerHTML = '<div class="vipps-boks"><strong>Vipps mangler.</strong><br>Legg inn Vipps-nummer på Firma og trykk Lagre firma.</div>';
      return;
    }
    el.innerHTML = '<div class="vipps-boks"><h3>Vipps på faktura</h3>' +
      '<div><strong>' + esc(navn) + '</strong></div>' +
      '<div>Vippsnummer: <strong>' + esc(nr) + '</strong></div>' +
      '<div class="vipps-mini">Vipps blir også skrevet nederst på faktura-PDF.</div></div>';
  }
  function koble() {
    patchJsPdf();
    var b = $("visVippsFakturaKnapp");
    if (b && !b.__vippsFix) {
      b.__vippsFix = true;
      b.addEventListener("click", visVippsFaktura);
    }
    ["firmaVippsNr", "firmaVippsNavn"].forEach(function (id) {
      var el = $(id);
      if (el && !el.__vippsLagre) {
        el.__vippsLagre = true;
        el.addEventListener("change", lagreVippsFraFirmafelt);
        el.addEventListener("blur", lagreVippsFraFirmafelt);
      }
    });
  }
  document.addEventListener("DOMContentLoaded", koble);
  window.addEventListener("load", koble);
  setInterval(koble, 1000);
  window.tegnVippsPaPdf = tegnVippsPaPdf;
  window.visVippsFaktura = window.visVippsFaktura || visVippsFaktura;
})();
