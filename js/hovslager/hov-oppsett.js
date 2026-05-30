console.log("hov-oppsett.js lastet");

let sisteHovFirma = null;

function hovOppsettEl(id) {
  return document.getElementById(id);
}

function hovOppsettTekst(id) {
  return String(hovOppsettEl(id)?.value || "").trim();
}

function hovOppsettSett(id, verdi) {
  const el = hovOppsettEl(id);
  if (el) el.value = verdi ?? "";
}

function hovOppsettMelding(tekst, feil = false) {
  const el = hovOppsettEl("firmaMelding");
  if (!el) return;
  el.textContent = tekst || "";
  el.style.color = feil ? "#b42318" : "#116329";
}

function normaliserLogoUrl(url) {
  const verdi = String(url || "").trim();
  return verdi || "bilder/logo.png";
}

function oppdaterLogoForhandsvisning() {
  const img = hovOppsettEl("firmaLogoForhandsvisning");
  if (!img) return;

  const url = normaliserLogoUrl(hovOppsettTekst("firmaLogoUrl"));
  img.src = url;
  img.style.display = "block";
}

async function hentFirmaData() {
  if (!window.supabaseClient) return {};

  const { data, error } = await window.supabaseClient
    .from("firma")
    .select("*")
    .limit(1);

  if (error) {
    console.error("Feil ved henting av firma:", error);
    return {};
  }

  sisteHovFirma = (data && data.length) ? data[0] : {};
  return sisteHovFirma;
}

function fyllHovOppsettSkjema(firma) {
  firma = firma || {};

  hovOppsettSett("firmaId", firma.id || "");
  hovOppsettSett("firmaNavn", firma.navn || "");
  hovOppsettSett("firmaAdresse", firma.adresse || "");
  hovOppsettSett("firmaTelefon", firma.telefon || "");
  hovOppsettSett("firmaEpost", firma.epost || "");
  hovOppsettSett("firmaOrgnr", firma.orgnr || firma.org_nr || "");
  hovOppsettSett("firmaMvaNr", firma.mva_nr || "");
  hovOppsettSett("firmaKontonr", firma.kontonr || "");
  hovOppsettSett("firmaLogoUrl", normaliserLogoUrl(firma.logo_url));
  hovOppsettSett("firmaBrevhodeTekst", firma.brevhode_tekst || "");
  hovOppsettSett("firmaBrevfotTekst", firma.brevfot_tekst || "");

  oppdaterLogoForhandsvisning();
}

async function lastHovOppsett() {
  const firma = await hentFirmaData();
  fyllHovOppsettSkjema(firma);
  return firma;
}

async function lagreHovOppsett() {
  hovOppsettMelding("");

  const rad = {
    navn: hovOppsettTekst("firmaNavn"),
    adresse: hovOppsettTekst("firmaAdresse") || null,
    telefon: hovOppsettTekst("firmaTelefon") || null,
    epost: hovOppsettTekst("firmaEpost") || null,
    orgnr: hovOppsettTekst("firmaOrgnr") || null,
    mva_nr: hovOppsettTekst("firmaMvaNr") || null,
    kontonr: hovOppsettTekst("firmaKontonr") || null,
    logo_url: normaliserLogoUrl(hovOppsettTekst("firmaLogoUrl")),
    brevhode_tekst: hovOppsettTekst("firmaBrevhodeTekst") || null,
    brevfot_tekst: hovOppsettTekst("firmaBrevfotTekst") || null
  };

  if (!rad.navn) {
    hovOppsettMelding("Skriv firmanavn før du lagrer.", true);
    return false;
  }

  const id = hovOppsettTekst("firmaId");

  const res = id
    ? await window.supabaseClient.from("firma").update(rad).eq("id", id).select().single()
    : await window.supabaseClient.from("firma").insert(rad).select().single();

  if (res.error) {
    console.error("Feil ved lagring av firmaoppsett:", res.error);
    hovOppsettMelding("Feil ved lagring: " + res.error.message, true);
    return false;
  }

  sisteHovFirma = res.data || rad;
  fyllHovOppsettSkjema(sisteHovFirma);
  hovOppsettMelding("Oppsett lagret.");
  return true;
}

async function sjekkHovOppsett() {
  const firma = await lastHovOppsett();

  if (!firma || !firma.navn) {
    if (typeof visSide === "function") {
      visSide("firmaSide");
    }

    hovOppsettMelding(
      "Fyll inn firmaoppsett første gang. Dette lagres og brukes på faktura/kreditnota.",
      true
    );

    return false;
  }

  return true;
}

async function lastBildeSomDataUrl(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const blob = await res.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Kunne ikke laste logo:", url, e);
    return null;
  }
}

async function leggTilLogo(doc, firma, x = 14, y = 10, maxW = 42, maxH = 24) {
  firma = firma || sisteHovFirma || {};
  const logoUrl = normaliserLogoUrl(firma.logo_url);
  const dataUrl = await lastBildeSomDataUrl(logoUrl);

  if (!dataUrl) return false;

  const format = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";

  try {
    doc.addImage(dataUrl, format, x, y, maxW, maxH, undefined, "FAST");
    return true;
  } catch (e) {
    console.warn("Kunne ikke legge logo i PDF:", e);
    return false;
  }
}

async function tegnBrevhodePdf(doc, firma) {
  firma = firma || await hentFirmaData();

  await leggTilLogo(doc, firma, 14, 10, 38, 22);

  doc.setFontSize(14);
  doc.text(String(firma.navn || ""), 60, 16);

  doc.setFontSize(9);

  let y = 22;
  const linjer = [];

  if (firma.adresse) linjer.push(firma.adresse);
  if (firma.telefon) linjer.push("Tlf: " + firma.telefon);
  if (firma.epost) linjer.push("E-post: " + firma.epost);
  if (firma.orgnr || firma.org_nr) linjer.push("Org.nr: " + (firma.orgnr || firma.org_nr));
  if (firma.mva_nr) linjer.push("MVA: " + firma.mva_nr);
  if (firma.brevhode_tekst) linjer.push(firma.brevhode_tekst);

  linjer.forEach(linje => {
    doc.text(String(linje), 60, y);
    y += 5;
  });

  doc.line(14, 42, 195, 42);
}

function tegnBrevfotAlleSiderPdf(doc, firma) {
  firma = firma || sisteHovFirma || {};

  const sideAntall = doc.getNumberOfPages();

  for (let i = 1; i <= sideAntall; i++) {
    doc.setPage(i);

    doc.setFontSize(8);
    doc.line(14, 280, 195, 280);

    const deler = [];
    if (firma.navn) deler.push(firma.navn);
    if (firma.kontonr) deler.push("Kontonr: " + firma.kontonr);
    if (firma.epost) deler.push(firma.epost);
    if (firma.telefon) deler.push("Tlf: " + firma.telefon);

    let tekst = deler.join(" | ");
    if (firma.brevfot_tekst) {
      tekst = tekst ? tekst + " | " + firma.brevfot_tekst : firma.brevfot_tekst;
    }

    doc.text(String(tekst || ""), 14, 286);
    doc.text("Side " + i + " av " + sideAntall, 178, 286);
  }
}

function tegnSkilleLinjePdf(doc, y, x1 = 14, x2 = 195) {
  doc.line(x1, y, x2, y);
}

function kobleHovOppsett() {
  const knapp = hovOppsettEl("lagreHovOppsettKnapp");
  if (knapp) {
    knapp.addEventListener("click", lagreHovOppsett);
  }

  const logoFelt = hovOppsettEl("firmaLogoUrl");
  if (logoFelt) {
    logoFelt.addEventListener("change", oppdaterLogoForhandsvisning);
    logoFelt.addEventListener("input", oppdaterLogoForhandsvisning);
  }
}

window.hentFirmaData = hentFirmaData;
window.lastHovOppsett = lastHovOppsett;
window.lagreHovOppsett = lagreHovOppsett;
window.sjekkHovOppsett = sjekkHovOppsett;
window.tegnBrevhodePdf = tegnBrevhodePdf;
window.tegnBrevfotAlleSiderPdf = tegnBrevfotAlleSiderPdf;
window.tegnSkilleLinjePdf = tegnSkilleLinjePdf;
window.leggTilLogo = leggTilLogo;
window.kobleHovOppsett = kobleHovOppsett;
