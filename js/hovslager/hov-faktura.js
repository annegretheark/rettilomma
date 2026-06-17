console.log("hov-faktura.js lastet - DEMO/OVERSIKT FIX 20260617");

function fakturaMelding(tekst, feil = false) {
  const el = document.getElementById("fakturaMelding");
  if (!el) return;
  el.textContent = tekst || "";
  el.style.color = feil ? "#b42318" : "#116329";
}

function kr(n) {
  return Number(n || 0).toLocaleString("no-NO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function hovFakturaNorm(v) {
  return String(v || "").replace(/\s+/g, " ").trim();
}

function hovFakturaNormLav(v) {
  return hovFakturaNorm(v).toLowerCase();
}

function hovErUuid(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || "").trim());
}

function hovParseBelopNo(v) {
  const s = String(v || "")
    .replace(/kr/ig, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");
  const n = Number(s || 0);
  return Number.isFinite(n) ? n : 0;
}

async function fyllFakturaKunder() {
  const sel = document.getElementById("fakturaKunde");
  if (!sel || !window.supabaseClient) return;

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
  if (!kunder.length) fakturaMelding("");
}

async function hovFinnKundeForFaktura(kundeRef) {
  const ref = hovFakturaNorm(kundeRef);
  if (!ref || !window.supabaseClient) return null;

  if (hovErUuid(ref)) {
    const { data, error } = await supabaseClient
      .from("kunder")
      .select("*")
      .eq("id", ref)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  const { data, error } = await supabaseClient.from("kunder").select("*");
  if (error) throw error;

  const needle = hovFakturaNormLav(ref);
  return (data || []).find(k =>
    hovFakturaNormLav(k.navn) === needle ||
    hovFakturaNormLav(k.epost) === needle ||
    hovFakturaNormLav(k.telefon) === needle
  ) || null;
}

async function hovHentAktivFirmaIdTrygt() {
  if (typeof window.hentAktivHovFirmaId !== "function") return null;
  try { return await window.hentAktivHovFirmaId(); }
  catch (e) { console.warn("Kunne ikke hente aktivt firma til faktura:", e); return null; }
}

async function hovHentUfakturerteJobberForKunde(kundeId, kundeNavn = "") {
  if (!window.supabaseClient || !kundeId) return [];
  const firmaId = await hovHentAktivFirmaIdTrygt();

  async function hentAlle(medFirma) {
    let q = supabaseClient
      .from("hov_jobber")
      .select("*, kunder(navn), hester(id,navn,kunde_id)")
      .order("dato", { ascending: true });
    if (medFirma && firmaId) q = q.eq("firma_id", firmaId);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }

  async function hestIdsForKunde(medFirma) {
    let q = supabaseClient.from("hester").select("id, navn, kunde_id").eq("kunde_id", kundeId);
    if (medFirma && firmaId) q = q.eq("firma_id", firmaId);
    const { data, error } = await q;
    if (error) return { ids: new Set(), map: new Map() };
    return {
      ids: new Set((data || []).map(h => String(h.id))),
      map: new Map((data || []).map(h => [String(h.id), h]))
    };
  }

  async function filtrer(alle, medFirma) {
    const navn = hovFakturaNormLav(kundeNavn);
    const hester = await hestIdsForKunde(medFirma);
    const jobber = (alle || []).filter(j => {
      const ikkeFakturert = j.fakturert !== true && !j.fakturanr && !j.faktura_id;
      if (!ikkeFakturert) return false;
      return String(j.kunde_id || "") === String(kundeId) ||
        String(j.hester?.kunde_id || "") === String(kundeId) ||
        hester.ids.has(String(j.hest_id || "")) ||
        (navn && hovFakturaNormLav(j.kunder?.navn) === navn);
    });
    jobber.forEach(j => {
      if (!j.hester && hester.map.has(String(j.hest_id || ""))) {
        const h = hester.map.get(String(j.hest_id || ""));
        j.hester = { id: h.id, navn: h.navn, kunde_id: h.kunde_id };
      }
    });
    return jobber;
  }

  let alle = await hentAlle(true);
  let jobber = await filtrer(alle, true);
  if (jobber.length || !firmaId) return jobber;

  alle = await hentAlle(false);
  return await filtrer(alle, false);
}

function hovFakturaHentKundeFraTekst(tekst) {
  const t = hovFakturaNorm(tekst);
  if (!t) return "";
  let m = t.match(/^[-–—]?\s*(.*?)\s+\d+\s+[\d\s.,]+\s*kr\s+Ikke\s+fakturert/i);
  if (m && m[1]) return hovFakturaNorm(m[1]);
  m = t.match(/^[-–—]?\s*([A-ZÆØÅ][A-Za-zÆØÅæøå .'-]+?)\s+\d+\s+/);
  if (m && m[1]) return hovFakturaNorm(m[1]);
  return "";
}

function hovFakturaHentKundeFraKnapp(el) {
  if (!el) return "";
  const dataVerdi = el.dataset?.kundeId || el.dataset?.kunde || el.dataset?.kundenavn ||
    el.getAttribute?.("data-kunde-id") || el.getAttribute?.("data-kunde") || el.getAttribute?.("data-kundenavn") || "";
  if (dataVerdi) return hovFakturaNorm(dataVerdi);

  const s = String(el.getAttribute?.("onclick") || "");
  const m = s.match(/\(\s*['\"]([^'\"]+)['\"]/);
  if (m && m[1]) return hovFakturaNorm(m[1]);

  const tr = el.closest?.("tr");
  if (tr) {
    const direkte = tr.dataset?.kundeId || tr.getAttribute?.("data-kunde-id") || "";
    if (direkte) return hovFakturaNorm(direkte);
    const celler = Array.from(tr.querySelectorAll("td"));
    if (celler[1]) return hovFakturaNorm(celler[1].textContent || "");
  }

  let p = el.parentElement;
  for (let i = 0; p && i < 8; i += 1, p = p.parentElement) {
    const kunde = hovFakturaHentKundeFraTekst(p.textContent || "");
    if (kunde && !/^fakturanr kunde jobber/i.test(kunde)) return kunde;
  }
  return "";
}

function hovFakturaFinnKlikketFakturaElement(target) {
  let el = target;
  for (let i = 0; el && i < 8; i += 1, el = el.parentElement) {
    const tekst = (el.textContent || el.value || "").toLowerCase();
    if (tekst.includes("lag") && tekst.includes("faktura")) return el;
  }
  return null;
}

function hovFakturaFinnSynligRadForKunde(kundeRef = "") {
  const needle = hovFakturaNormLav(kundeRef);
  const rader = Array.from(document.querySelectorAll("tr, .rad, div, section, article"));
  for (const rad of rader) {
    const tekst = hovFakturaNorm(rad.textContent || "");
    if (!/ikke\s+fakturert/i.test(tekst) || !/lag\s+faktura/i.test(tekst)) continue;
    const kunde = hovFakturaHentKundeFraTekst(tekst);
    if (!kunde || /^fakturanr kunde jobber/i.test(kunde)) continue;
    if (!needle || hovFakturaNormLav(kunde) === needle) return rad;
  }
  return null;
}

function hovFakturaLesDemoRad(rad, fallbackKunde = "") {
  if (!rad) return null;
  const tekst = hovFakturaNorm(rad.textContent || "");
  const kunde = hovFakturaHentKundeFraTekst(tekst) || fallbackKunde;
  let belop = 0;
  let jobber = 1;

  const celler = Array.from(rad.querySelectorAll?.("td") || []);
  if (celler.length >= 5) {
    jobber = Number(hovFakturaNorm(celler[2]?.textContent || "1")) || 1;
    belop = hovParseBelopNo(celler[3]?.textContent || "0");
  }
  if (!belop) {
    const m = tekst.match(/\s(\d+)\s+([\d\s.,]+)\s*kr\s+Ikke\s+fakturert/i);
    if (m) {
      jobber = Number(m[1] || 1) || 1;
      belop = hovParseBelopNo(m[2] || 0);
    }
  }

  if (!kunde || !belop) return null;
  return { kunde: { navn: kunde, adresse: "", epost: "" }, jobber, inklMva: belop };
}

function hovFakturaLagPdf({ fakturanr, kunde, jobber, eksMva, mva, inklMva }) {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) throw new Error("jsPDF er ikke lastet, kan ikke lage PDF.");

  const doc = new jsPDF();
  let y = 24;
  doc.setFontSize(18);
  doc.text("FAKTURA", 20, y); y += 10;
  doc.setFontSize(10);
  doc.text("Fakturanr: " + fakturanr, 20, y); y += 7;
  doc.text("Dato: " + new Date().toISOString().slice(0, 10), 20, y); y += 12;

  doc.setFontSize(12);
  doc.text("Kunde:", 20, y); y += 7;
  doc.setFontSize(10);
  doc.text(String(kunde.navn || ""), 20, y); y += 6;
  if (kunde.adresse) { doc.text(String(kunde.adresse || ""), 20, y); y += 6; }
  if (kunde.epost) { doc.text(String(kunde.epost || ""), 20, y); y += 6; }
  y += 8;

  doc.setFontSize(11);
  doc.text("Dato", 20, y);
  doc.text("Beskrivelse", 45, y);
  doc.text("Beløp", 160, y);
  y += 6;
  doc.line(20, y, 190, y);
  y += 8;

  for (const j of jobber) {
    if (y > 260) { doc.addPage(); y = 20; }
    const arbeid = Number(j.arbeid_belop || 0);
    const varer = Number(j.varer_belop || 0);
    const km = Number(j.km || 0);
    const kmPris = Number(j.km_pris || 0);
    const kj = km * kmPris;
    const linjeBelop = arbeid || Number(j.linje_belop || 0) || (Number(j.total || 0) / 1.25);
    const hestNavn = j.hester?.navn || j.hest_navn || "Hovslagerjobb";

    doc.setFontSize(10);
    doc.text(String(j.dato || new Date().toISOString().slice(0, 10)), 20, y);
    doc.text(`${hestNavn} - ${j.jobbtype || "Skoing"}`.slice(0, 55), 45, y);
    doc.text(kr(linjeBelop) + " kr", 160, y); y += 6;

    if (kj > 0) { doc.setFontSize(9); doc.text(`Kjøring ${km} km x ${kr(kmPris)} kr`, 45, y); doc.text(kr(kj) + " kr", 160, y); y += 6; }
    if (varer > 0) { doc.setFontSize(9); doc.text("Sko / varer", 45, y); doc.text(kr(varer) + " kr", 160, y); y += 6; }
    if (j.beskrivelse) { doc.setFontSize(8); doc.text(String(j.beskrivelse).slice(0, 90), 45, y); y += 5; }
    y += 4;
  }

  y += 8;
  doc.line(120, y, 190, y); y += 8;
  doc.setFontSize(10);
  doc.text("Sum eks. mva", 120, y); doc.text(kr(eksMva) + " kr", 160, y); y += 7;
  doc.text("MVA 25%", 120, y); doc.text(kr(mva) + " kr", 160, y); y += 8;
  doc.setFontSize(12);
  doc.text("Sum inkl. mva", 120, y); doc.text(kr(inklMva) + " kr", 160, y);
  doc.save(fakturanr + ".pdf");
}

async function hovLagDemoFakturaFraSynligRad(kundeRef = "", rad = null) {
  const valgtRad = rad || hovFakturaFinnSynligRadForKunde(kundeRef);
  const demo = hovFakturaLesDemoRad(valgtRad, kundeRef);
  if (!demo) return false;

  const fakturanr = "HOV-DEMO-" + Date.now();
  const inklMva = demo.inklMva;
  const eksMva = inklMva / 1.25;
  const mva = inklMva - eksMva;
  const jobber = [{
    dato: new Date().toISOString().slice(0, 10),
    jobbtype: "Hovslagerjobb",
    hest_navn: "Demo",
    linje_belop: eksMva,
    total: inklMva
  }];

  hovFakturaLagPdf({ fakturanr, kunde: demo.kunde, jobber, eksMva, mva, inklMva });
  fakturaMelding("Demofaktura laget: " + fakturanr);

  if (valgtRad) {
    valgtRad.innerHTML = valgtRad.innerHTML.replace(/Ikke\s+fakturert/i, "Fakturert").replace(/>-</, ">" + fakturanr + "<");
  }
  return true;
}

async function lagHovFaktura(kundeRef = "", rad = null) {
  try {
    const kundeFelt = document.getElementById("fakturaKunde");
    let ref = hovFakturaNorm(kundeRef || kundeFelt?.value || "");
    if (!ref && rad) ref = hovFakturaHentKundeFraTekst(rad.textContent || "");

    const demoRad = rad || hovFakturaFinnSynligRadForKunde(ref);

    // Demo-siden viser ferdige rader uten at jobbene nødvendigvis finnes i hov_jobber.
    // Derfor lager vi PDF fra synlig rad hvis kunden ikke er valgt i nedtrekk eller ikke finnes i DB.
    if (!ref && demoRad) ref = hovFakturaHentKundeFraTekst(demoRad.textContent || "");
    if (!ref) { fakturaMelding("Velg kunde først.", true); return false; }

    fakturaMelding("Lager faktura...");

    let kunde = null;
    let jobber = [];
    if (window.supabaseClient) {
      try {
        kunde = await hovFinnKundeForFaktura(ref);
        if (kunde?.id) {
          if (kundeFelt) kundeFelt.value = kunde.id;
          jobber = await hovHentUfakturerteJobberForKunde(kunde.id, kunde.navn || ref);
        }
      } catch (dbE) {
        console.warn("DB-faktura hoppet til demo fallback:", dbE);
      }
    }

    if (!kunde?.id || !jobber.length) {
      return await hovLagDemoFakturaFraSynligRad(ref, demoRad);
    }

    const fakturanr = "HOV-" + Date.now();
    const eksMva = jobber.reduce((sum, j) => sum + Number(j.arbeid_belop || 0) + Number(j.varer_belop || 0) + (Number(j.km || 0) * Number(j.km_pris || 0)), 0);
    const mva = eksMva * 0.25;
    const inklMva = eksMva + mva;

    // Lag PDF først, så brukeren faktisk får faktura selv om DB-oppdatering stopper.
    hovFakturaLagPdf({ fakturanr, kunde, jobber, eksMva, mva, inklMva });

    const firmaId = await hovHentAktivFirmaIdTrygt();
    const payload = { fakturanr, kunde_id: kunde.id, eks_mva: eksMva, mva, inkl_mva: inklMva };
    if (firmaId) payload.firma_id = firmaId;

    let fakturaRes = await supabaseClient.from("hov_fakturaer").insert([payload]);
    if (fakturaRes.error && firmaId && /firma_id|schema cache|column/i.test(fakturaRes.error.message || "")) {
      delete payload.firma_id;
      fakturaRes = await supabaseClient.from("hov_fakturaer").insert([payload]);
    }
    if (fakturaRes.error) console.warn("Faktura-PDF laget, men lagring i hov_fakturaer feilet:", fakturaRes.error);

    const ids = jobber.map(j => j.id).filter(Boolean);
    if (ids.length) {
      const { error: oppdaterError } = await supabaseClient.from("hov_jobber").update({ fakturert: true, fakturanr }).in("id", ids);
      if (oppdaterError) console.warn("Faktura-PDF laget, men merking som fakturert feilet:", oppdaterError);
    }

    fakturaMelding("Faktura laget: " + fakturanr);
    if (typeof window.hentJobber === "function") await window.hentJobber();
    if (typeof window.visFakturaOversikt === "function") await window.visFakturaOversikt();
    if (typeof window.hentFakturaOversikt === "function") await window.hentFakturaOversikt();
    return true;
  } catch (e) {
    console.error("Feil i lagHovFaktura:", e);
    fakturaMelding("Feil ved faktura: " + (e.message || e), true);
    return false;
  }
}

function hovFakturaStoppOgKjor(el, ev) {
  const fakturaEl = hovFakturaFinnKlikketFakturaElement(el);
  if (!fakturaEl) return false;

  const tekst = (fakturaEl.textContent || fakturaEl.value || "").toLowerCase();
  if (!tekst.includes("lag") || !tekst.includes("faktura")) return false;

  if (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === "function") ev.stopImmediatePropagation();
  }

  const rad = fakturaEl.closest?.("tr") || fakturaEl.closest?.(".rad") || null;
  const ref = hovFakturaHentKundeFraKnapp(fakturaEl) ||
    hovFakturaHentKundeFraTekst(rad?.textContent || "") ||
    document.getElementById("fakturaKunde")?.value || "";

  lagHovFaktura(ref, rad);
  return true;
}

function hovFakturaErKnapp(el) {
  const tekst = (el?.textContent || el?.value || "").toLowerCase();
  return tekst.includes("lag") && tekst.includes("faktura");
}

function hovFakturaBindKnapper() {
  document.querySelectorAll("button, a, [role='button'], input[type='button'], input[type='submit']").forEach(el => {
    if (!hovFakturaErKnapp(el)) return;
    if (el.dataset.hovFakturaNyFix === "2") return;

    const ny = el.cloneNode(true);
    ny.dataset.hovFakturaNyFix = "2";
    ny.removeAttribute("onclick");
    ny.addEventListener("click", ev => hovFakturaStoppOgKjor(ny, ev), true);
    el.parentNode?.replaceChild(ny, el);
  });
}

function hovFakturaInstallerGlobaleNavn() {
  const f = ref => lagHovFaktura(ref);
  window.lagHovFaktura = f;
  window.lagHovFakturaForKunde = f;
  window.lagFakturaForKunde = f;
  window.lagFaktura = f;
  window.lagFakturaKunde = f;
  window.lagKundeFaktura = f;
  window.lagDemoFaktura = f;
  window.lagDemofaktura = f;
  window.lagFakturaFraOversikt = f;
  window.lagHovFakturaFraOversikt = f;
  window.opprettFaktura = f;
  window.opprettHovFaktura = f;
  window.genererFaktura = f;
  window.genererHovFaktura = f;
  window.fakturerKunde = f;
  window.fakturerDemoKunde = f;
  window.fyllFakturaKunder = fyllFakturaKunder;
  window.hovFakturaBindKnapper = hovFakturaBindKnapper;
}

document.addEventListener("click", function(ev) {
  hovFakturaStoppOgKjor(ev.target, ev);
}, true);

document.addEventListener("DOMContentLoaded", () => {
  fyllFakturaKunder();
  hovFakturaInstallerGlobaleNavn();
  hovFakturaBindKnapper();

  const sel = document.getElementById("fakturaKunde");
  if (sel) {
    sel.addEventListener("focus", fyllFakturaKunder);
    sel.addEventListener("click", () => { if (sel.options.length <= 1) fyllFakturaKunder(); });
  }
});

hovFakturaInstallerGlobaleNavn();
hovFakturaBindKnapper();
[100, 300, 700, 1200, 2500, 5000, 9000].forEach(ms => {
  setTimeout(() => {
    hovFakturaInstallerGlobaleNavn();
    hovFakturaBindKnapper();
  }, ms);
});

try {
  const obs = new MutationObserver(() => {
    hovFakturaInstallerGlobaleNavn();
    hovFakturaBindKnapper();
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
} catch (e) {}
