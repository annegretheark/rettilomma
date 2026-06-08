/* PURRING FAKTURA FIX 2026-06-08
   Legg denne inn etter jsPDF, Supabase/config og etter okonomi.js.
   Den gir purring-knapp fra økonomioversikten og lager enkel purring-PDF med Vipps. */
(function () {
  function tekst(v) { return String(v == null ? "" : v).trim(); }
  function tall(v) {
    var n = Number(String(v || 0).replace(" ", "").replace(",", "."));
    return isFinite(n) ? n : 0;
  }
  function kr(n) {
    return (Math.round(tall(n) * 100) / 100).toLocaleString("nb-NO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + " kr";
  }
  function dato(v) { return v ? String(v).slice(0, 10) : ""; }
  function id(id) { return document.getElementById(id); }

  function hentVippsNr() {
    return tekst(
      (id("firmaVippsNr") || {}).value ||
      localStorage.getItem("firmaVippsNr") ||
      localStorage.getItem("vippsNr") ||
      (window.firma && window.firma.vipps_nummer) ||
      (window.firmaOppsett && window.firmaOppsett.vipps_nummer) ||
      ""
    ).replace(/\s+/g, "");
  }

  function hentVippsNavn(firma) {
    return tekst(
      (id("firmaVippsNavn") || {}).value ||
      localStorage.getItem("firmaVippsNavn") ||
      (firma && (firma.vipps_mottaker || firma.navn)) ||
      (window.firma && (window.firma.vipps_mottaker || window.firma.navn)) ||
      (window.firmaOppsett && (window.firmaOppsett.vipps_mottaker || window.firmaOppsett.navn)) ||
      (id("firmaNavn") || {}).value ||
      localStorage.getItem("firmaNavn") ||
      ""
    );
  }

  async function hentEnRad(tabell, felt, verdi) {
    if (!window.supabaseClient) return null;
    try {
      var res = await supabaseClient.from(tabell).select("*").eq(felt, verdi).maybeSingle();
      if (res && !res.error && res.data) return res.data;
    } catch (e) {}
    return null;
  }

  async function hentForsteRad(tabell) {
    if (!window.supabaseClient) return null;
    try {
      var res = await supabaseClient.from(tabell).select("*").limit(1).maybeSingle();
      if (res && !res.error && res.data) return res.data;
    } catch (e) {}
    return null;
  }

  async function markerPurret(fakturanr) {
    if (!window.supabaseClient || !fakturanr) return;
    var iDag = new Date().toISOString().slice(0, 10);
    try {
      await supabaseClient.from("fakturaer").update({
        status: "purret",
        betalingsstatus: "purret",
        purret_dato: iDag
      }).eq("fakturanr", fakturanr);
    } catch (e) {
      try {
        await supabaseClient.from("fakturaer").update({ status: "purret" }).eq("fakturanr", fakturanr);
      } catch (e2) {}
    }
  }

  async function lagPurringFraOkonomi(fakturanr) {
    try {
      if (!fakturanr) {
        alert("Mangler fakturanummer.");
        return;
      }
      if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDF-biblioteket er ikke lastet. Sjekk at jsPDF ligger før purring-scriptet i index.html.");
        return;
      }
      if (!window.supabaseClient) {
        alert("Supabase er ikke lastet. Sjekk js/core/config.js.");
        return;
      }

      var faktura = await hentEnRad("fakturaer", "fakturanr", fakturanr);
      if (!faktura) {
        alert("Fant ikke faktura " + fakturanr + ".");
        return;
      }

      var kundeId = faktura.kunden_id || faktura.kunde_id || faktura.kundeId;
      var kunde = kundeId ? await hentEnRad("kunder", "id", kundeId) : null;
      var firma = await hentForsteRad("firma");

      var belop = tall(faktura.inkl_mva || faktura.total || faktura.sum || faktura.belop || 0);
      var betalt = tall(faktura.betalt_belop || 0);
      var rest = Math.max(0, belop - betalt);
      var nyForfall = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      var nr = hentVippsNr();
      var mottaker = hentVippsNavn(firma);

      var doc = new window.jspdf.jsPDF();
      var y = 20;
      doc.setFontSize(18);
      doc.text("Purring", 20, y);
      y += 12;
      doc.setFontSize(11);

      if (firma && firma.navn) { doc.text(String(firma.navn), 20, y); y += 6; }
      if (firma && firma.orgnr) { doc.text("Org.nr: " + String(firma.orgnr), 20, y); y += 6; }
      if (firma && firma.epost) { doc.text(String(firma.epost), 20, y); y += 6; }
      y += 6;

      doc.text("Kunde: " + String((kunde && (kunde.navn || kunde.firmanavn)) || faktura.kunde_navn || ""), 20, y); y += 7;
      if (kunde && kunde.adresse) { doc.text(String(kunde.adresse), 20, y); y += 6; }
      if (kunde && (kunde.postnr || kunde.poststed)) { doc.text(String((kunde.postnr || "") + " " + (kunde.poststed || "")).trim(), 20, y); y += 6; }
      y += 8;

      doc.setFontSize(12);
      doc.text("Gjelder faktura: " + String(fakturanr), 20, y); y += 7;
      doc.text("Fakturadato: " + dato(faktura.dato || faktura.created_at), 20, y); y += 7;
      doc.text("Opprinnelig forfall: " + dato(faktura.forfallsdato), 20, y); y += 7;
      doc.text("Beløp faktura: " + kr(belop), 20, y); y += 7;
      if (betalt > 0) { doc.text("Registrert betalt: " + kr(betalt), 20, y); y += 7; }
      doc.setFontSize(14);
      doc.text("Restbeløp å betale: " + kr(rest), 20, y); y += 10;

      doc.setFontSize(11);
      doc.text("Vi kan ikke se at fakturaen er registrert betalt.", 20, y); y += 6;
      doc.text("Betal restbeløpet innen " + nyForfall + ".", 20, y); y += 10;

      if (nr) {
        doc.setFontSize(12);
        doc.text("Betal med Vipps", 20, y); y += 7;
        doc.setFontSize(11);
        doc.text("Vippsnummer: " + nr + (mottaker ? "   Mottaker: " + mottaker : ""), 20, y); y += 7;
        doc.text("Merk betalingen med fakturanummer " + String(fakturanr) + ".", 20, y); y += 7;
      }

      await markerPurret(fakturanr);
      doc.save("purring-" + String(fakturanr).replace(/[^a-zA-Z0-9_-]/g, "") + ".pdf");

      if (typeof window.visOkonomiOversikt === "function") {
        await window.visOkonomiOversikt();
      }
    } catch (e) {
      console.error("Purring feilet:", e);
      alert("Kunne ikke lage purring: " + (e && e.message ? e.message : e));
    }
  }

  window.lagPurringFraOkonomi = lagPurringFraOkonomi;
})();
