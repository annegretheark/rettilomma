console.log("hov-faktura.js lastet");

function fakturaMelding(tekst, feil = false) {

  const el =
    document.getElementById("fakturaMelding");

  if (el) {

    el.textContent = tekst || "";

    el.style.color =
      feil ? "#b42318" : "#116329";
  }
}

function kr(n) {

  return Number(n || 0)
    .toLocaleString(
      "no-NO",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }
    );
}

async function fyllFakturaKunder() {

  const sel = document.getElementById("fakturaKunde");
  if (!sel) return;

  const aktivVerdi = sel.value || "";

  sel.innerHTML = `<option value="">Laster kunder...</option>`;

  const res = await supabaseClient
    .from("kunder")
    .select("id, navn, epost, telefon, adresse")
    .order("navn", { ascending: true });

  if (res.error) {
    console.error("Feil ved henting av kunder:", res.error);
    sel.innerHTML = `<option value="">Kunne ikke hente kunder</option>`;
    fakturaMelding("Feil ved henting av kunder: " + res.error.message, true);
    return;
  }

  const kunder = res.data || [];

  sel.innerHTML = `<option value="">Velg kunde</option>`;

  kunder.forEach(k => {
    const opt = document.createElement("option");
    opt.value = k.id;
    opt.textContent = k.navn || k.epost || k.telefon || ("Kunde " + k.id);
    sel.appendChild(opt);
  });

  if (aktivVerdi) sel.value = aktivVerdi;

  // Ikke vis rød feilmelding her.
  // Ved første lasting kan auth/firma fortsatt være på vei inn, og da kan listen midlertidig være tom.
  if (!kunder.length) {
    fakturaMelding("");
  }
}

async function lagHovFaktura(kundeIdDirekte = "") {

  try {

    const kundeFelt = document.getElementById("fakturaKunde");
    const kundeId = String(kundeIdDirekte || (kundeFelt ? kundeFelt.value : "") || "").trim();

    if (kundeFelt && kundeId) kundeFelt.value = kundeId;

    if (!kundeId) {
      fakturaMelding("Velg kunde først.", true);
      return;
    }

    fakturaMelding("Henter kunde og ufakturerte jobber...");

    const kundeRes = await supabaseClient
      .from("kunder")
      .select("*")
      .eq("id", kundeId)
      .single();

    if (kundeRes.error) {
      fakturaMelding(kundeRes.error.message, true);
      return;
    }

    let jobbQuery = supabaseClient
      .from("hov_jobber")
      .select("*, hester(navn,kunde_id), kunder(navn)")
      .or("fakturert.is.false,fakturert.is.null")
      .order("dato", { ascending: true });

    // Hold faktureringen innenfor aktivt firma når appen kjører med firma/RLS.
    let aktivFirmaId = null;
    if (typeof window.hentAktivHovFirmaId === "function") {
      try { aktivFirmaId = await window.hentAktivHovFirmaId(); } catch (e) { aktivFirmaId = null; }
    }
    if (aktivFirmaId) jobbQuery = jobbQuery.eq("firma_id", aktivFirmaId);

    const jobbRes = await jobbQuery;

    if (jobbRes.error) {
      fakturaMelding(jobbRes.error.message, true);
      return;
    }

    const alleJobber = jobbRes.data || [];

    const jobber = alleJobber.filter(j =>
      String(j.kunde_id || "") === String(kundeId) ||
      String(j.hester?.kunde_id || "") === String(kundeId)
    );

    if (!jobber.length) {
      fakturaMelding("Ingen ufakturerte jobber funnet på valgt kunde. Sjekk at jobbene ligger på samme kunde/eier som du valgte i faktura.", true);
      return;
    }

    const manglerKundeId = jobber.filter(j =>
      !j.kunde_id &&
      j.hester?.kunde_id &&
      String(j.hester.kunde_id) === String(kundeId)
    );

    if (manglerKundeId.length) {
      await supabaseClient
        .from("hov_jobber")
        .update({ kunde_id: kundeId })
        .in("id", manglerKundeId.map(j => j.id));
    }

    const fakturanr = "HOV-" + Date.now();

    const eksMva = jobber.reduce((sum, j) => {
      return sum +
        Number(j.arbeid_belop || 0) +
        Number(j.varer_belop || 0) +
        (Number(j.km || 0) * Number(j.km_pris || 0));
    }, 0);

    const mva = eksMva * 0.25;
    const inklMva = eksMva + mva;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const firma =
      typeof hentFirmaData === "function"
        ? await hentFirmaData()
        : {};

    if (typeof tegnBrevhodePdf === "function") {
      await tegnBrevhodePdf(doc, firma);
    }

    let y = 56;

    doc.setFontSize(18);
    doc.text("FAKTURA", 20, y);
    y += 10;

    doc.setFontSize(10);
    doc.text("Fakturanr: " + fakturanr, 20, y);
    y += 7;
    doc.text("Dato: " + new Date().toISOString().slice(0, 10), 20, y);
    y += 12;

    doc.setFontSize(12);
    doc.text("Kunde:", 20, y);
    y += 7;

    doc.setFontSize(10);
    doc.text(String(kundeRes.data.navn || ""), 20, y);
    y += 6;
    doc.text(String(kundeRes.data.adresse || ""), 20, y);
    y += 6;
    doc.text(String(kundeRes.data.epost || ""), 20, y);
    y += 14;

    doc.setFontSize(11);
    doc.text("Dato", 20, y);
    doc.text("Beskrivelse", 45, y);
    doc.text("Beløp", 160, y);
    y += 6;
    doc.line(20, y, 190, y);
    y += 8;

    for (const j of jobber) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }

      const arbeid = Number(j.arbeid_belop || 0);
      const varer = Number(j.varer_belop || 0);
      const km = Number(j.km || 0);
      const kmPris = Number(j.km_pris || 0);
      const kj = km * kmPris;
      const hestNavn = j.hester?.navn || "Uten hest";

      doc.setFontSize(10);
      doc.text(String(j.dato || ""), 20, y);
      doc.text(`${hestNavn} - ${j.jobbtype || "Skoing"}`, 45, y);
      doc.text(kr(arbeid) + " kr", 160, y);
      y += 6;

      if (kj > 0) {
        doc.setFontSize(9);
        doc.text(`Kjøring ${km} km x ${kr(kmPris)} kr`, 45, y);
        doc.text(kr(kj) + " kr", 160, y);
        y += 6;
      }

      if (varer > 0) {
        doc.setFontSize(9);
        doc.text("Sko / varer", 45, y);
        doc.text(kr(varer) + " kr", 160, y);
        y += 6;
      }

      if (j.beskrivelse) {
        doc.setFontSize(8);
        doc.text(String(j.beskrivelse).slice(0, 90), 45, y);
        y += 5;
      }

      y += 4;
    }

    y += 8;
    doc.line(120, y, 190, y);
    y += 8;

    doc.setFontSize(10);
    doc.text("Sum eks. mva", 120, y);
    doc.text(kr(eksMva) + " kr", 160, y);
    y += 7;

    doc.text("MVA 25%", 120, y);
    doc.text(kr(mva) + " kr", 160, y);
    y += 8;

    doc.setFontSize(12);
    doc.text("Sum inkl. mva", 120, y);
    doc.text(kr(inklMva) + " kr", 160, y);

    if (firma && (firma.vipps_nummer || firma.vipps_mottaker)) {
      const vippsX = 20;
      let vippsY = 270;

      doc.setFontSize(11);
      doc.text("Betaling med Vipps", vippsX, vippsY);
      vippsY += 6;

      doc.setFontSize(10);
      if (firma.vipps_nummer) {
        doc.text("Vipps: " + String(firma.vipps_nummer), vippsX, vippsY);
        vippsY += 5;
      }
      if (firma.vipps_mottaker) {
        doc.text("Mottaker: " + String(firma.vipps_mottaker), vippsX, vippsY);
      }
    }

    const fakturaPayload = {
      fakturanr,
      kunde_id: kundeId,
      eks_mva: eksMva,
      mva,
      inkl_mva: inklMva
    };
    if (aktivFirmaId) fakturaPayload.firma_id = aktivFirmaId;

    let fakturaRes = await supabaseClient
      .from("hov_fakturaer")
      .insert([fakturaPayload]);

    // Tåler eldre demo-tabell uten firma_id, uten å endre noe annet.
    if (fakturaRes.error && aktivFirmaId && /firma_id|schema cache|column/i.test(fakturaRes.error.message || "")) {
      delete fakturaPayload.firma_id;
      fakturaRes = await supabaseClient
        .from("hov_fakturaer")
        .insert([fakturaPayload]);
    }

    if (fakturaRes.error) {
      fakturaMelding(fakturaRes.error.message, true);
      return;
    }

    const ids = jobber.map(j => j.id);

    const oppdaterRes = await supabaseClient
      .from("hov_jobber")
      .update({
        fakturert: true,
        fakturanr
      })
      .in("id", ids);

    if (oppdaterRes.error) {
      fakturaMelding(oppdaterRes.error.message, true);
      return;
    }

    if (typeof tegnBrevfotAlleSiderPdf === "function") {
      tegnBrevfotAlleSiderPdf(doc, firma);
    }

    doc.save(fakturanr + ".pdf");

    fakturaMelding("Faktura laget: " + fakturanr);

    if (typeof hentJobber === "function") {
      await hentJobber();
    }
    if (typeof window.visFakturaOversikt === "function") {
      await window.visFakturaOversikt();
    }
    if (typeof window.hentFakturaOversikt === "function") {
      await window.hentFakturaOversikt();
    }

  } catch (e) {
    console.error("Feil i lagHovFaktura:", e);
    fakturaMelding("Feil ved faktura: " + (e.message || e), true);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(fyllFakturaKunder, 300);
  setTimeout(fyllFakturaKunder, 1200);
  setTimeout(bindHovFakturaKnapperRobust, 500);
  setTimeout(bindHovFakturaKnapperRobust, 1500);

  const sel = document.getElementById("fakturaKunde");
  if (sel) {
    sel.addEventListener("focus", fyllFakturaKunder);
    sel.addEventListener("click", () => {
      if (sel.options.length <= 1) fyllFakturaKunder();
    });
  }
});


// Bakoverkompatible navn brukt av demo.html / gamle knapper.
async function lagHovFakturaForKunde(kundeId) {
  return lagHovFaktura(kundeId);
}
async function lagFakturaForKunde(kundeId) {
  return lagHovFaktura(kundeId);
}
async function lagFaktura(kundeId) {
  return lagHovFaktura(kundeId);
}
async function lagDemoFaktura(kundeId) {
  // I demo skal knappen lage faktura for valgt kunde. Hvis ingen er valgt,
  // brukes første kunde med ufakturert jobb. Ingen ferdigfakturerte jobber røres.
  let id = kundeId || document.getElementById("fakturaKunde")?.value || "";
  if (!id && window.supabaseClient) {
    try {
      let q = supabaseClient
        .from("hov_jobber")
        .select("kunde_id, hester(kunde_id)")
        .or("fakturert.is.false,fakturert.is.null")
        .limit(20);
      const { data } = await q;
      const rad = (data || []).find(j => j.kunde_id || j.hester?.kunde_id);
      id = rad?.kunde_id || rad?.hester?.kunde_id || "";
    } catch (e) {
      console.warn("Kunne ikke finne demokunde automatisk:", e);
    }
  }
  return lagHovFaktura(id);
}

function bindHovFakturaKnapperRobust() {
  document.querySelectorAll("[data-kunde-id]").forEach(knapp => {
    const tekst = (knapp.textContent || "").toLowerCase();
    if (!tekst.includes("faktura")) return;
    if (knapp.dataset.hovFakturaBind === "1") return;
    knapp.dataset.hovFakturaBind = "1";
    knapp.addEventListener("click", ev => {
      const id = knapp.dataset.kundeId || knapp.getAttribute("data-kunde-id") || "";
      if (id) {
        ev.preventDefault();
        lagHovFaktura(id);
      }
    });
  });
}


window.lagHovFaktura =
  lagHovFaktura;

window.fyllFakturaKunder =
  fyllFakturaKunder;
window.lagHovFakturaForKunde = lagHovFakturaForKunde;
window.lagFakturaForKunde = lagFakturaForKunde;
window.lagFaktura = lagFaktura;
window.lagDemoFaktura = lagDemoFaktura;
window.bindHovFakturaKnapperRobust = bindHovFakturaKnapperRobust;