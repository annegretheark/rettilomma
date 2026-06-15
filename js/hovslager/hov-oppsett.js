console.log("hov-oppsett.js lastet - firma kan vises og redigeres");

let hovFirmaTabell = null;
let hovFirmaRad = null;

function hovOppsettMelding(tekst, feil = false) {
  const el = document.getElementById("firmaMelding");
  if (el) {
    el.textContent = tekst || "";
    el.style.color = feil ? "#fca5a5" : "#86efac";
  }
}

function hovOppsettVerdi(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function hovSettOppsettVerdi(id, verdi) {
  const el = document.getElementById(id);
  if (el) el.value = verdi || "";
}

function hovOppsettLogoPreview(url) {
  const img = document.getElementById("firmaLogoForhandsvisning");
  if (!img) return;
  if (url) {
    img.src = url;
    img.style.display = "block";
  } else {
    img.removeAttribute("src");
    img.style.display = "none";
  }
}

function hovFirmaFraSkjema() {
  return {
    navn: hovOppsettVerdi("firmaNavn"),
    firmanavn: hovOppsettVerdi("firmaNavn"),
    adresse: hovOppsettVerdi("firmaAdresse"),
    telefon: hovOppsettVerdi("firmaTelefon"),
    epost: hovOppsettVerdi("firmaEpost"),
    orgnr: hovOppsettVerdi("firmaOrgnr"),
    org_nr: hovOppsettVerdi("firmaOrgnr"),
    mva_nr: hovOppsettVerdi("firmaMvaNr"),
    kontonr: hovOppsettVerdi("firmaKontonr"),
    kontonummer: hovOppsettVerdi("firmaKontonr"),
    vipps_nummer: hovOppsettVerdi("firmaVippsNummer"),
    vipps_mottaker: hovOppsettVerdi("firmaVippsMottaker"),
    logo_url: hovOppsettVerdi("firmaLogoUrl"),
    brevhode_tekst: hovOppsettVerdi("firmaBrevhodeTekst"),
    brevfot_tekst: hovOppsettVerdi("firmaBrevfotTekst")
  };
}

function hovFirmaTilSkjema(firma) {
  firma = firma || {};
  hovFirmaRad = firma;
  hovSettOppsettVerdi("firmaId", firma.id || "");
  hovSettOppsettVerdi("firmaNavn", firma.navn || firma.firmanavn || firma.firma_navn || "");
  hovSettOppsettVerdi("firmaAdresse", firma.adresse || "");
  hovSettOppsettVerdi("firmaTelefon", firma.telefon || "");
  hovSettOppsettVerdi("firmaEpost", firma.epost || firma.email || "");
  hovSettOppsettVerdi("firmaOrgnr", firma.orgnr || firma.org_nr || firma.organisasjonsnummer || "");
  hovSettOppsettVerdi("firmaMvaNr", firma.mva_nr || firma.mvanr || "");
  hovSettOppsettVerdi("firmaKontonr", firma.kontonr || firma.kontonummer || "");
  hovSettOppsettVerdi("firmaVippsNummer", firma.vipps_nummer || firma.vippsnummer || firma.vipps_nr || firma.vipps || "");
  hovSettOppsettVerdi("firmaVippsMottaker", firma.vipps_mottaker || firma.vipps_navn || firma.vippsNavn || "");
  hovSettOppsettVerdi("firmaLogoUrl", firma.logo_url || firma.logo || "");
  hovSettOppsettVerdi("firmaBrevhodeTekst", firma.brevhode_tekst || firma.brevhode || "");
  hovSettOppsettVerdi("firmaBrevfotTekst", firma.brevfot_tekst || firma.brevfot || "");
  hovOppsettLogoPreview(firma.logo_url || firma.logo || "");
}

function hovFiltrerPayloadMotRad(payload, rad) {
  if (!rad || !Object.keys(rad).length) return payload;
  const tillatte = new Set(Object.keys(rad));
  const ut = {};
  for (const [k, v] of Object.entries(payload)) {
    if (tillatte.has(k)) ut[k] = v;
  }
  return ut;
}

function hovFjernManglendeKolonne(payload, error) {
  const msg = String(error?.message || "");
  const treff = msg.match(/'([^']+)' column/) || msg.match(/column "([^"]+)"/i);
  if (treff && treff[1] && Object.prototype.hasOwnProperty.call(payload, treff[1])) {
    delete payload[treff[1]];
    return true;
  }
  return false;
}



async function hentInnloggetHovEpost() {
  const { data: userData, error: userError } = await supabaseClient.auth.getUser();
  if (userError) throw userError;
  const epost = String(userData?.user?.email || "").trim().toLowerCase();
  if (!epost) throw new Error("Fant ikke innlogget e-post.");
  return epost;
}

async function opprettHovFirmaForInnloggetBruker(epost) {
  // Første bruker uten eksisterende firma får automatisk eget firma og adminrolle.
  // Hvis kolonnene rolle/er_admin ikke finnes ennå, fjernes de automatisk fra payload.
  let payload = {
    navn: (window.HOV_FIRMA_NAVN || window.HOV_FIRMA_LINK || "Hovslager"),
    epost,
    rolle: "admin",
    er_admin: true
  };

  let res;
  for (let forsok = 0; forsok < 5; forsok++) {
    res = await supabaseClient
      .from("hov_firma")
      .insert([payload])
      .select("*")
      .maybeSingle();

    if (!res.error) break;
    if (!hovFjernManglendeKolonne(payload, res.error)) throw res.error;
  }

  if (res.error) throw res.error;
  if (!res.data?.id) throw new Error("Kunne ikke opprette hov_firma for innlogget bruker.");

  window.hovAktivFirmaId = res.data.id;
  window.hovAktivFirma = res.data;
  hovFirmaRad = res.data;
  hovFirmaTabell = "hov_firma";
  return res.data;
}

async function hentAktivHovFirmaId() {
  if (!window.supabaseClient) throw new Error("Mangler Supabase-klient.");

  if (window.hovAktivFirmaId) return window.hovAktivFirmaId;

  const epost = await hentInnloggetHovEpost();

  const { data, error } = await supabaseClient
    .from("hov_firma")
    .select("*")
    .ilike("epost", epost)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const firma = data?.id ? data : await opprettHovFirmaForInnloggetBruker(epost);

  window.hovAktivFirmaId = firma.id;
  window.hovAktivFirma = firma;
  hovFirmaRad = firma;
  hovFirmaTabell = "hov_firma";
  return firma.id;
}

async function hovVelgFirmaTabell() {
  if (!window.supabaseClient) throw new Error("Mangler Supabase-klient.");
  if (hovFirmaTabell) return hovFirmaTabell;

  for (const tabell of ["hov_firma", "firma"]) {
    try {
      const { data, error } = await supabaseClient.from(tabell).select("*").limit(1).maybeSingle();
      if (!error) {
        hovFirmaTabell = tabell;
        hovFirmaRad = data || null;
        return tabell;
      }
    } catch (e) {
      console.warn("Firma-tabell ikke klar:", tabell, e);
    }
  }

  throw new Error("Fant ikke tabellen hov_firma eller firma.");
}

async function hentFirmaData() {
  const tabell = await hovVelgFirmaTabell();

  if (tabell === "hov_firma") {
    const epost = await hentInnloggetHovEpost();
    const { data, error } = await supabaseClient
      .from(tabell)
      .select("*")
      .ilike("epost", epost)
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    const firma = data?.id ? data : await opprettHovFirmaForInnloggetBruker(epost);
    hovFirmaTabell = tabell;
    hovFirmaRad = firma || null;
    if (firma?.id) {
      window.hovAktivFirmaId = firma.id;
      window.hovAktivFirma = firma;
    }
    return firma || {};
  }

  const { data, error } = await supabaseClient.from(tabell).select("*").limit(1).maybeSingle();
  if (error) throw error;
  hovFirmaTabell = tabell;
  hovFirmaRad = data || null;
  return data || {};
}

async function lastHovOppsett() {
  try {
    hovOppsettMelding("Henter firmaoppsett...");
    const firma = await hentFirmaData();
    hovFirmaTilSkjema(firma);
    hovOppsettMelding(Object.keys(firma).length ? "Firmaoppsett hentet." : "Ingen firmaoppsett lagret ennå. Fyll ut og lagre.");
    return true;
  } catch (e) {
    console.error("Kunne ikke hente firmaoppsett:", e);
    hovOppsettMelding("Kunne ikke hente firmaoppsett: " + (e.message || e), true);
    return false;
  }
}

async function lastOppHovLogoHvisValgt() {
  const fil = document.getElementById("firmaLogoFil")?.files?.[0];
  if (!fil || !window.supabaseClient) return "";

  const rentNavn = String(fil.name || "logo.png")
    .replaceAll(" ", "_")
    .replace(/[æøåÆØÅ]/g, b => ({ æ: "ae", ø: "o", å: "a", Æ: "Ae", Ø: "O", Å: "A" }[b] || b))
    .replace(/[^a-zA-Z0-9._-]/g, "_");
  const filsti = `hov-logo/${Date.now()}_${rentNavn}`;

  const { error: uploadError } = await supabaseClient.storage.from("bilder").upload(filsti, fil, { upsert: true });
  if (uploadError) throw new Error("Logo ble ikke lastet opp: " + uploadError.message);

  const { data } = supabaseClient.storage.from("bilder").getPublicUrl(filsti);
  return data?.publicUrl || "";
}

async function lagreHovOppsett() {
  try {
    hovOppsettMelding("Lagrer firmaoppsett...");
    const tabell = await hovVelgFirmaTabell();

    const logoUrl = await lastOppHovLogoHvisValgt();
    if (logoUrl) hovSettOppsettVerdi("firmaLogoUrl", logoUrl);

    let payload = hovFirmaFraSkjema();
    payload = hovFiltrerPayloadMotRad(payload, hovFirmaRad);

    let res;
    const id = hovOppsettVerdi("firmaId") || hovFirmaRad?.id || "";

    for (let forsok = 0; forsok < 8; forsok++) {
      if (id) {
        res = await supabaseClient.from(tabell).update(payload).eq("id", id).select("*").maybeSingle();
      } else if (hovFirmaRad?.id) {
        res = await supabaseClient.from(tabell).update(payload).eq("id", hovFirmaRad.id).select("*").maybeSingle();
      } else {
        res = await supabaseClient.from(tabell).insert([payload]).select("*").maybeSingle();
      }

      if (!res.error) break;
      if (!hovFjernManglendeKolonne(payload, res.error)) throw res.error;
    }

    if (res.error) throw res.error;

    hovFirmaRad = res.data || { ...(hovFirmaRad || {}), ...payload };
    hovFirmaTilSkjema(hovFirmaRad);
    hovOppsettMelding("Firmaoppsett lagret.");
    return true;
  } catch (e) {
    console.error("Kunne ikke lagre firmaoppsett:", e);
    hovOppsettMelding("Kunne ikke lagre firmaoppsett: " + (e.message || e), true);
    return false;
  }
}

function kobleHovOppsett() {
  const knapp = document.getElementById("lagreHovOppsettKnapp");
  if (knapp && knapp.dataset.koblet !== "1") {
    knapp.dataset.koblet = "1";
    knapp.addEventListener("click", lagreHovOppsett);
  }

  const logoFelt = document.getElementById("firmaLogoUrl");
  if (logoFelt && logoFelt.dataset.koblet !== "1") {
    logoFelt.dataset.koblet = "1";
    logoFelt.addEventListener("input", () => hovOppsettLogoPreview(logoFelt.value));
  }

  setTimeout(lastHovOppsett, 200);
}

async function sjekkHovOppsett() {
  if (typeof kobleHovOppsett === "function") kobleHovOppsett();
  await lastHovOppsett();
  return true;
}

function pdfFirmaNavn(firma) {
  return firma?.navn || firma?.firmanavn || firma?.firma_navn || "";
}

async function tegnBrevhodePdf(doc, firma) {
  firma = firma || await hentFirmaData();
  let y = 16;
  doc.setFontSize(14);
  const navn = pdfFirmaNavn(firma);
  if (navn) doc.text(String(navn), 20, y);
  y += 6;
  doc.setFontSize(9);
  const linjer = [firma.adresse, firma.telefon, firma.epost || firma.email, firma.orgnr || firma.org_nr, firma.brevhode_tekst].filter(Boolean);
  for (const l of linjer) {
    doc.text(String(l), 20, y);
    y += 5;
  }
}

function tegnBrevfotAlleSiderPdf(doc, firma) {
  firma = firma || {};
  const tekst = firma.brevfot_tekst || firma.brevfot || "";
  const sider = doc.getNumberOfPages ? doc.getNumberOfPages() : 1;
  for (let i = 1; i <= sider; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    if (tekst) doc.text(String(tekst).slice(0, 110), 20, 286);
    doc.text("Side " + i + " av " + sider, 170, 286);
  }
}

window.kobleHovOppsett = kobleHovOppsett;
window.sjekkHovOppsett = sjekkHovOppsett;
window.hentInnloggetHovEpost = hentInnloggetHovEpost;
window.opprettHovFirmaForInnloggetBruker = opprettHovFirmaForInnloggetBruker;
window.hentAktivHovFirmaId = hentAktivHovFirmaId;
window.hentFirmaData = hentFirmaData;
window.hentAktivHovFirmaId = hentAktivHovFirmaId;
window.lastHovOppsett = lastHovOppsett;
window.lagreHovOppsett = lagreHovOppsett;
window.tegnBrevhodePdf = window.tegnBrevhodePdf || tegnBrevhodePdf;
window.tegnBrevfotAlleSiderPdf = window.tegnBrevfotAlleSiderPdf || tegnBrevfotAlleSiderPdf;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", kobleHovOppsett);
} else {
  kobleHovOppsett();
}
