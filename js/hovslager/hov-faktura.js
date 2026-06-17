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


async function hovFinnKundeForFaktura(kundeVerdi) {
  const verdi = String(kundeVerdi || "").trim();
  if (!verdi) return null;

  // Prøv som UUID bare når verdien faktisk er UUID.
  // Ellers kan Supabase/Postgres feile før vi får søkt på kundenavn.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(verdi)) {
    const res = await supabaseClient
      .from("kunder")
      .select("*")
      .eq("id", verdi)
      .maybeSingle();

    if (!res.error && res.data) return res.data;
  }

  // Søk trygt i JS. Da tåler vi mellomrom/æøå i kundenavn fra demo-tabellen.
  const res = await supabaseClient
    .from("kunder")
    .select("*");

  if (res.error) throw res.error;

  const norm = v => String(v || "").trim().toLowerCase();
  const needle = norm(verdi);

  return (res.data || []).find(k =>
    norm(k.navn) === needle ||
    norm(k.epost) === needle ||
    norm(k.telefon) === needle
  ) || null;
}

async function hovHentUfakturerteJobberForKunde(kundeId, aktivFirmaId, kundeNavn = "") {
  async function hentAlleJobber(medFirmaFilter) {
    let jobbQuery = supabaseClient
      .from("hov_jobber")
      .select("*, hester(navn,kunde_id), kunder(navn)")
      .or("fakturert.is.false,fakturert.is.null")
      .order("dato", { ascending: true });

    if (medFirmaFilter && aktivFirmaId) jobbQuery = jobbQuery.eq("firma_id", aktivFirmaId);

    const jobbRes = await jobbQuery;
    if (jobbRes.error) throw jobbRes.error;
    return jobbRes.data || [];
  }

  async function filtrerJobber(alleJobber, medFirmaFilter) {
    const norm = v => String(v || "").trim().toLowerCase();
    const navnNorm = norm(kundeNavn);

    let jobber = alleJobber.filter(j =>
      String(j.kunde_id || "") === String(kundeId) ||
      String(j.hester?.kunde_id || "") === String(kundeId) ||
      (navnNorm && norm(j.kunder?.navn) === navnNorm)
    );

    // Ekstra sikkerhet: noen demo-rader har hest_id, men Supabase-relasjonen
    // hester(kunde_id) kommer ikke alltid med. Da henter vi hestene separat.
    if (!jobber.length) {
      let hesteQuery = supabaseClient
        .from("hester")
        .select("id, navn, kunde_id")
        .eq("kunde_id", kundeId);
      if (medFirmaFilter && aktivFirmaId) hesteQuery = hesteQuery.eq("firma_id", aktivFirmaId);

      const hesteRes = await hesteQuery;
      if (!hesteRes.error) {
        const hestIds = new Set((hesteRes.data || []).map(h => String(h.id)));
        const hestMap = new Map((hesteRes.data || []).map(h => [String(h.id), h]));
        jobber = alleJobber.filter(j => hestIds.has(String(j.hest_id || "")));
        jobber.forEach(j => {
          const h = hestMap.get(String(j.hest_id || ""));
          if (h && !j.hester) j.hester = { navn: h.navn, kunde_id: h.kunde_id };
        });
      }
    }

    return jobber;
  }

  // Først riktig firma. Hvis demo.html/aktivt firma peker feil, prøver vi uten firmafilter.
  // Det er dette som gjør at synlige "Ikke fakturert"-rader faktisk kan faktureres.
  const medFirma = await hentAlleJobber(true);
  let jobber = await filtrerJobber(medFirma, true);
  if (jobber.length || !aktivFirmaId) return jobber;

  const utenFirma = await hentAlleJobber(false);
  return await filtrerJobber(utenFirma, false);
}

function hovHentKundeVerdiFraFakturaRad(knapp) {
  const tr = knapp?.closest?.("tr");
  if (!tr) return "";

  const direkte = tr.dataset.kundeId || tr.getAttribute("data-kunde-id") || "";
  if (direkte) return direkte;

  // Demo-oversikten har kolonnene: Fakturanr, Kunde, Jobber, Beløp, Status.
  const celler = Array.from(tr.querySelectorAll("td"));
  return String(celler[1]?.textContent || "").trim();
}

async function lagHovFaktura(kundeIdDirekte = "") {

  try {

    const kundeFelt = document.getElementById("fakturaKunde");
    const kundeVerdi = String(kundeIdDirekte || (kundeFelt ? kundeFelt.value : "") || "").trim();

    if (!kundeVerdi) {
      fakturaMelding("Velg kunde først.", true);
      return;
    }

    fakturaMelding("Henter kunde og ufakturerte jobber...");

    const kundeData = await hovFinnKundeForFaktura(kundeVerdi);

    if (!kundeData?.id) {
      fakturaMelding("Fant ikke kunde: " + kundeVerdi, true);
      return;
    }

    const kundeId = String(kundeData.id);
    const kundeRes = { data: kundeData };

    if (kundeFelt && kundeId) kundeFelt.value = kundeId;

    // Hold faktureringen innenfor aktivt firma når appen kjører med firma/RLS.
    let aktivFirmaId = null;
    if (typeof window.hentAktivHovFirmaId === "function") {
      try { aktivFirmaId = await window.hentAktivHovFirmaId(); } catch (e) { aktivFirmaId = null; }
    }

    const jobber = await hovHentUfakturerteJobberForKunde(kundeId, aktivFirmaId, kundeData.navn || kundeVerdi);

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


function hovFakturaKlikkDelegert(ev) {
  const knapp = ev.target?.closest?.("button, input[type='button'], input[type='submit']");
  if (!knapp) return;

  const tekst = (knapp.textContent || knapp.value || "").toLowerCase();
  if (!tekst.includes("faktura")) return;

  const direkte = knapp.dataset.kundeId || knapp.getAttribute("data-kunde-id") || "";
  const fraRad = hovHentKundeVerdiFraFakturaRad(knapp);
  const valgt = document.getElementById("fakturaKunde")?.value || "";
  const verdi = direkte || fraRad || valgt;

  // Radknappene i demo-oversikten får kundenavn fra raden.
  // Da lager vi faktura for akkurat den kunden og stopper gammel demokode.
  if (verdi) {
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
    lagHovFaktura(verdi);
  }
}

document.addEventListener("click", hovFakturaKlikkDelegert, true);

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
  document.querySelectorAll("button, input[type='button'], input[type='submit']").forEach(knapp => {
    const tekst = (knapp.textContent || knapp.value || "").toLowerCase();
    if (!tekst.includes("faktura")) return;
    if (knapp.dataset.hovFakturaBind === "1") return;
    knapp.dataset.hovFakturaBind = "1";

    knapp.addEventListener("click", ev => {
      const direkte = knapp.dataset.kundeId || knapp.getAttribute("data-kunde-id") || "";
      const fraRad = hovHentKundeVerdiFraFakturaRad(knapp);
      const valgt = document.getElementById("fakturaKunde")?.value || "";
      const verdi = direkte || fraRad || valgt;

      // Bare overstyr gamle demo-knapper når vi faktisk finner kunde fra rad/knapp/valg.
      if (verdi) {
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
        lagHovFaktura(verdi);
      }
    }, true);
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
window.hovFinnKundeForFaktura = hovFinnKundeForFaktura;
window.hovHentUfakturerteJobberForKunde = hovHentUfakturerteJobberForKunde;
// === RETT I LOMMA FIX 4: Ta kontroll over demo-fakturaknapper uten å røre annet ===
// Problem: demo.html kan ha egne inline-funksjoner og radoppsett uten <tr>.
// Denne blokken finner kunden fra selve raden/teksten og stopper gammel demokode før den viser
// "Ingen jobber ble fakturert".
function hovFakturaNormaliserTekst(v) {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function hovFakturaKundeFraTekstlinje(tekst) {
  const t = hovFakturaNormaliserTekst(tekst);
  if (!t) return "";

  // Typisk rad: "- Anne Lunde 1 1 632,50 kr Ikke fakturert Lag faktura"
  let m = t.match(/^[-–—]?\s*(.*?)\s+\d+\s+[\d\s.,]+\s*kr\s+Ikke\s+fakturert/i);
  if (m && m[1]) return hovFakturaNormaliserTekst(m[1]);

  // Alternativ: "Anne Lunde 1 1 632,50 kr Ikke fakturert Lag faktura"
  m = t.match(/^(.*?)\s+\d+\s+[\d\s.,]+\s*kr\s+Ikke\s+fakturert/i);
  if (m && m[1]) return hovFakturaNormaliserTekst(m[1].replace(/^[-–—]\s*/, ""));

  return "";
}

function hovFakturaKundeFraOnclick(knapp) {
  const s = String(knapp?.getAttribute?.("onclick") || "");
  if (!s) return "";

  // Hent første argument i anførselstegn, f.eks. lagFaktura('Anne Lunde')
  const m = s.match(/\((?:\s*)['"]([^'"]+)['"]/);
  if (m && m[1]) return hovFakturaNormaliserTekst(m[1]);

  return "";
}

function hovHentKundeVerdiFraFakturaRadRobust(knapp) {
  if (!knapp) return "";

  const dataVerdi =
    knapp.dataset?.kundeId ||
    knapp.dataset?.kunde ||
    knapp.dataset?.kundenavn ||
    knapp.getAttribute?.("data-kunde-id") ||
    knapp.getAttribute?.("data-kunde") ||
    knapp.getAttribute?.("data-kundenavn") ||
    "";
  if (dataVerdi) return hovFakturaNormaliserTekst(dataVerdi);

  const fraOnclick = hovFakturaKundeFraOnclick(knapp);
  if (fraOnclick) return fraOnclick;

  const tr = knapp.closest?.("tr");
  if (tr) {
    const direkte = tr.dataset?.kundeId || tr.getAttribute?.("data-kunde-id") || "";
    if (direkte) return hovFakturaNormaliserTekst(direkte);
    const celler = Array.from(tr.querySelectorAll("td"));
    if (celler[1]) return hovFakturaNormaliserTekst(celler[1].textContent || "");
  }

  // Demo-oversikten kan være bygget med div/grid, ikke tabell.
  let el = knapp.parentElement;
  for (let i = 0; el && i < 8; i += 1, el = el.parentElement) {
    const tekst = hovFakturaKundeFraTekstlinje(el.textContent || "");
    if (tekst && !/^fakturanr kunde jobber beløp status/i.test(tekst)) return tekst;
  }

  return "";
}

async function hovLagFakturaFraKnapp(knapp, ev) {
  const tekst = (knapp?.textContent || knapp?.value || "").toLowerCase();
  if (!tekst.includes("lag") || !tekst.includes("faktura")) return false;

  const verdi =
    hovHentKundeVerdiFraFakturaRadRobust(knapp) ||
    document.getElementById("fakturaKunde")?.value ||
    "";

  if (!verdi) return false;

  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
  }

  await lagHovFaktura(verdi);
  return false;
}

function hovBindFakturaKnapperFix4() {
  document.querySelectorAll("button, input[type='button'], input[type='submit']").forEach(knapp => {
    const tekst = (knapp.textContent || knapp.value || "").toLowerCase();
    if (!tekst.includes("lag") || !tekst.includes("faktura")) return;

    // Fjern gammel inline onclick på akkurat faktura-lage-knapper.
    // Andre knapper, f.eks. oversikt, røres ikke.
    if (knapp.getAttribute("onclick")) {
      knapp.dataset.gammelOnclick = knapp.getAttribute("onclick");
      knapp.removeAttribute("onclick");
    }

    if (knapp.dataset.hovFakturaFix4 === "1") return;
    knapp.dataset.hovFakturaFix4 = "1";
    knapp.addEventListener("click", function(ev) {
      hovLagFakturaFraKnapp(knapp, ev);
    }, true);
  });
}

function hovInstallerFakturaFunksjonerFix4() {
  window.lagHovFaktura = lagHovFaktura;
  window.lagHovFakturaForKunde = function(kundeId) { return lagHovFaktura(kundeId); };
  window.lagFakturaForKunde = function(kundeId) { return lagHovFaktura(kundeId); };
  window.lagFaktura = function(kundeId) { return lagHovFaktura(kundeId); };
  window.lagFakturaKunde = function(kundeId) { return lagHovFaktura(kundeId); };
  window.lagKundeFaktura = function(kundeId) { return lagHovFaktura(kundeId); };
  window.lagDemoFaktura = function(kundeId) {
    const valgt = kundeId || document.getElementById("fakturaKunde")?.value || "";
    return lagHovFaktura(valgt);
  };
  window.hovLagFakturaFraKnapp = hovLagFakturaFraKnapp;
  window.hovHentKundeVerdiFraFakturaRadRobust = hovHentKundeVerdiFraFakturaRadRobust;
}

// Capture helt øverst i klikkflyten. Dette stopper gammel demo-kode før den rekker å skrive feil melding.
document.addEventListener("click", function(ev) {
  const knapp = ev.target?.closest?.("button, input[type='button'], input[type='submit']");
  if (!knapp) return;
  const tekst = (knapp.textContent || knapp.value || "").toLowerCase();
  if (tekst.includes("lag") && tekst.includes("faktura")) {
    hovLagFakturaFraKnapp(knapp, ev);
  }
}, true);

hovInstallerFakturaFunksjonerFix4();
hovBindFakturaKnapperFix4();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function() {
    hovInstallerFakturaFunksjonerFix4();
    hovBindFakturaKnapperFix4();
  });
}

[100, 400, 900, 1600, 3000, 5000].forEach(ms => {
  setTimeout(function() {
    hovInstallerFakturaFunksjonerFix4();
    hovBindFakturaKnapperFix4();
  }, ms);
});

try {
  const obs = new MutationObserver(function() {
    hovInstallerFakturaFunksjonerFix4();
    hovBindFakturaKnapperFix4();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
} catch (e) {}


// === RETT I LOMMA FIX 5: Fanger også <a>/<div>-knapper og tom "Lag demofaktura" ===
function hovFinnForsteSynligeFakturaKunde() {
  const kandidater = Array.from(document.querySelectorAll("tr, div, section, article"));
  for (const el of kandidater) {
    const tekst = hovFakturaNormaliserTekst(el.textContent || "");
    if (!/ikke fakturert/i.test(tekst)) continue;
    const kunde = hovFakturaKundeFraTekstlinje(tekst);
    if (kunde && !/^fakturanr kunde jobber/i.test(kunde)) return kunde;
  }
  return "";
}

function hovFakturaFinnKlikkElement(target) {
  let el = target;
  for (let i = 0; el && i < 5; i += 1, el = el.parentElement) {
    const tekst = (el.textContent || el.value || "").toLowerCase();
    if (tekst.includes("lag") && tekst.includes("faktura")) return el;
  }
  return null;
}

async function hovLagFakturaFraAlleKnappetyper(el, ev) {
  if (!el) return false;
  const tekst = (el.textContent || el.value || "").toLowerCase();
  if (!tekst.includes("lag") || !tekst.includes("faktura")) return false;

  let verdi =
    hovHentKundeVerdiFraFakturaRadRobust(el) ||
    document.getElementById("fakturaKunde")?.value ||
    "";

  // Toppen "Lag demofaktura" har ikke kunde-id. Bruk første synlige ufakturerte rad.
  if (!verdi) verdi = hovFinnForsteSynligeFakturaKunde();

  if (!verdi) return false;

  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
  }

  await lagHovFaktura(verdi);
  return false;
}

document.addEventListener("click", function(ev) {
  const el = hovFakturaFinnKlikkElement(ev.target);
  if (el) hovLagFakturaFraAlleKnappetyper(el, ev);
}, true);

function hovBindFakturaAlleKnappetyperFix5() {
  document.querySelectorAll("button, a, [role='button'], input[type='button'], input[type='submit']").forEach(el => {
    const tekst = (el.textContent || el.value || "").toLowerCase();
    if (!tekst.includes("lag") || !tekst.includes("faktura")) return;
    if (el.getAttribute && el.getAttribute("onclick")) {
      el.dataset.gammelOnclick = el.getAttribute("onclick");
      el.removeAttribute("onclick");
    }
    if (el.dataset.hovFakturaFix5 === "1") return;
    el.dataset.hovFakturaFix5 = "1";
    el.addEventListener("click", function(ev) {
      hovLagFakturaFraAlleKnappetyper(el, ev);
    }, true);
  });
}

window.lagDemoFaktura = function(kundeId) {
  const valgt = kundeId || document.getElementById("fakturaKunde")?.value || hovFinnForsteSynligeFakturaKunde() || "";
  return lagHovFaktura(valgt);
};
window.hovBindFakturaAlleKnappetyperFix5 = hovBindFakturaAlleKnappetyperFix5;

hovBindFakturaAlleKnappetyperFix5();
[100, 300, 700, 1200, 2500, 5000, 9000].forEach(ms => setTimeout(hovBindFakturaAlleKnappetyperFix5, ms));
try {
  const obs5 = new MutationObserver(hovBindFakturaAlleKnappetyperFix5);
  obs5.observe(document.documentElement, { childList: true, subtree: true });
} catch (e) {}
